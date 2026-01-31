/* eslint-disable no-empty */
/* eslint-disable no-useless-escape */
/**
 * Galgame 界面插件 - SillyTavern 酒馆助手脚本
 * 功能：嵌入式视觉小说界面、立绘系统、对话解析
 * 版本：2.0.0
 */
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      // 防御性检查：确保 P 是有效的 Promise 构造函数
      P = P || Promise;
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
(function () {
  'use strict';
  // ============================================
  // 常量定义
  // ============================================
  const SCRIPT_ID = 'galgame-ui-plugin';
  const SCRIPT_NAME = 'Galgame界面插件';
  const VERSION = '2.2.0';
  const DB_NAME = 'GalgameUIPluginDB';
  const DB_VERSION = 2;
  const STORE_SPRITES = 'sprites';
  const STORE_BACKGROUNDS = 'backgrounds';
  // 样式主题常量 (Cyber Pop)
  const THEME = {
    white: '#ffffff',
    dark: '#2b2e38',
    accent: '#00d2ff',
    accentSub: '#ff0055',
    bgOverlay: 'rgba(255, 255, 255, 0.95)',
    fontMain: "'Noto Sans SC', sans-serif",
    fontEng: "'Barlow', sans-serif",
  };
  // 世界书配置
  const WORLDBOOK_NAME = 'galgame界面插件';
  const COT_ENTRY_NAME = 'Galgame输出格式规范';
  // 预设表情列表
  const EXPRESSION_LIST = ['默认', '微笑', '生气', '难过', '惊讶', '嘲讽', '害羞', '思考', '大笑', '搞怪'];
  // 表情到英文文生图tag的映射
  const EXPRESSION_TAG_MAP = {
    默认: 'neutral expression, looking at viewer',
    微笑: 'smile, happy, gentle expression',
    生气: 'angry, furrowed brows, intense eyes',
    难过: 'sad, tears, sorrowful expression',
    惊讶: 'surprised, wide eyes, open mouth',
    嘲讽: 'smirk, condescending, mocking expression',
    害羞: 'blush, shy, embarrassed, looking away',
    思考: 'thinking, hand on chin, contemplative',
    大笑: 'laughing, open mouth, closed eyes, very happy',
    搞怪: 'playful, wink, tongue out, silly face',
  };

  // 获取表情对应的英文tag（支持自定义表情回退到默认）
  function getExpressionTag(expressionName) {
    return EXPRESSION_TAG_MAP[expressionName] || `${expressionName} expression`;
  }

  // ============================================
  // 性能优化：预编译正则表达式
  // ============================================
  const RE_GAL_TAGS = /<(p|sprite|maintext|background)[^>]*>/i;
  const RE_CLOSED_P = /<\/p>/i;
  const RE_THINK_CLOSED = /<(think|thinking)>[\s\S]*?<\/\1>/gi;
  const RE_THINK_UNCLOSED = /<(think|thinking)>[\s\S]*$/gi;
  const RE_PRE_TAG = /<pre[^>]*>/gi;
  const RE_PRE_CLOSE = /<\/pre>/gi;
  const RE_CODE_TAG = /<code[^>]*>/gi;
  const RE_CODE_CLOSE = /<\/code>/gi;
  const RE_TAG_WHITESPACE = />\s+</g;
  const RE_MAINTEXT_CLOSED = /<maintext>([\s\S]*?)<\/maintext>/i;
  const RE_MAINTEXT_UNCLOSED = /<maintext>([\s\S]*)$/i;
  const RE_BACKGROUND = /<background\s+scene="([^"]+)"\s*[\/]?>/i;
  const RE_BGIMG = /<bgimg>(.*?)<\/bgimg>/i;
  const RE_BGM = /<bgm>(?:当前bgm[:：])?(.+?)<\/bgm>/i;
  const RE_OPTION = /<option\s+id="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
  const RE_P_TAG = /<p(?:\s[^>]*)?>[\s\S]*?<\/p>/gi;

  // ============================================
  // 性能优化：解析结果缓存
  // ============================================
  const parseCache = new Map();
  const PARSE_CACHE_MAX_SIZE = 30; // 最多缓存30条解析结果

  // ============================================
  // 性能优化：DOM 引用缓存
  // ============================================
  let $chatContainerCache = null;
  let $globalOverlayCache = null;

  function getCachedChatContainer() {
    if (
      !$chatContainerCache ||
      !$chatContainerCache.length ||
      !$.contains(topWindow.document, $chatContainerCache[0])
    ) {
      $chatContainerCache = $(topWindow.document).find('#chat');
    }
    return $chatContainerCache;
  }

  function getCachedGlobalOverlay() {
    if (
      !$globalOverlayCache ||
      !$globalOverlayCache.length ||
      !$.contains(topWindow.document, $globalOverlayCache[0])
    ) {
      $globalOverlayCache = $(topWindow.document).find('#gal-global-overlay');
    }
    return $globalOverlayCache;
  }

  // 清除 DOM 缓存（在覆盖层重建时调用）
  function invalidateDOMCache() {
    $chatContainerCache = null;
    $globalOverlayCache = null;
  }

  // ============================================
  // TTS 音色配置 (LittleWhiteBox)
  // ============================================
  const TTS_VOICE_LIST = [
    { name: '桃夭', gender: 'female_1', desc: '温柔少女' },
    { name: '夜枭', gender: 'male_1', desc: '沉稳男声' },
    { name: '霜华', gender: 'female_2', desc: '清冷女声' },
    { name: '顾姐', gender: 'female_3', desc: '成熟御姐' },
    { name: '苏菲', gender: 'female_4', desc: '元气少女' },
    { name: '嘉欣', gender: 'female_5', desc: '甜美声线' },
    { name: '青梅', gender: 'female_6', desc: '邻家女孩' },
    { name: '可莉', gender: 'female_7', desc: '活泼萝莉' },
    { name: '君泽', gender: 'male_2', desc: '儒雅公子' },
    { name: '沐阳', gender: 'male_3', desc: '阳光少年' },
    { name: '梓辛', gender: 'male_4', desc: '磁性低音' },
  ];

  // 角色TTS音色绑定存储键
  const CHAR_TTS_VOICE_KEY = `${SCRIPT_ID}_char_tts_voice`;

  /**
   * 获取角色绑定的TTS音色
   * @param {string} characterId - 角色名
   * @returns {string|null} 音色名
   */
  function getCharacterTTSVoice(characterId) {
    try {
      const map = JSON.parse(localStorage.getItem(CHAR_TTS_VOICE_KEY) || '{}');
      return map[characterId] || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 设置角色绑定的TTS音色
   * @param {string} characterId - 角色名
   * @param {string} voiceName - 音色名
   */
  function setCharacterTTSVoice(characterId, voiceName) {
    try {
      const map = JSON.parse(localStorage.getItem(CHAR_TTS_VOICE_KEY) || '{}');
      if (voiceName) {
        map[characterId] = voiceName;
      } else {
        delete map[characterId];
      }
      localStorage.setItem(CHAR_TTS_VOICE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 保存角色TTS音色失败:`, e);
    }
  }

  /**
   * 获取所有角色音色绑定
   * @returns {object} { 角色名: 音色名 }
   */
  function getAllCharacterTTSVoices() {
    try {
      return JSON.parse(localStorage.getItem(CHAR_TTS_VOICE_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  /**
   * 动态生成Galgame COT模板
   * 从数据库获取已上传的背景场景名称，注入到模板中
   */
  function generateCOTTemplate() {
    return __awaiter(this, void 0, void 0, function* () {
      // 获取所有已上传的背景场景名称
      let sceneNames = [];
      try {
        const backgrounds = yield getAllBackgrounds();
        sceneNames = backgrounds.map(bg => bg.sceneName);
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 获取场景列表失败:`, e);
      }

      // 获取完整表情列表（预设 + 自定义）
      const allExpressions = getAllExpressions();
      const expressionListText = allExpressions.join(', ');

      // 构建TTS音色列表
      const ttsVoiceListText = TTS_VOICE_LIST.map(v => `${v.name}(${v.desc})`).join(', ');

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
      if (settings.realTimeBackgroundGen) {
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

      // 构建示例中的场景名 - 实时生成模式下使用示例新场景名
      const exampleScene = settings.realTimeBackgroundGen
        ? '雨夜中的都市街道'
        : sceneNames.length > 0
          ? sceneNames[0]
          : '场景名';

      const extraRule = settings.realTimeBackgroundGen
        ? `5. **场景生成规则**: 当场景变化且图库中无匹配场景时，使用 \`<background scene="..."><bgimg>TAGS</bgimg>\` 格式生成新场景。TAGS必须是英文单词，逗号分隔，包含：场景类型、光线条件、氛围、风格、关键细节。`
        : `5. **背景场景必须使用已配置的场景名称**`;

      return `# Galgame 输出格式规范

本角色卡配合专用前端面板，输出将被解析为Galgame视觉小说界面。

## 输出格式要求
- 字数控制: 500-700字
- 分句数量: 15-25个p标签
- 显示风格: galgame逐句显示

## 标签系统

### 分句标签
- 格式: \`<p>内容</p>\`
- 长度: 50-70字
- 用途: 对话和旁白

### 对话格式（含表情）
- 格式: \`<p>角色名: "对话内容"<表情名></p>\`
- 表情标签紧跟在对话内容后面
- 表情列表: ${expressionListText}

### 旁白格式
- 格式: \`<p>旁白内容</p>\`
- 无需表情标签

### 配音指令 (TTS) - 仅角色对话
- **格式**: \`<p tts="speaker=音色名;emotion=情绪;context=语气提示">角色名: "对话内容"<表情></p>\`
- **可用音色列表**: ${ttsVoiceListText}
- **使用规则**:
  - **仅角色对话**: 旁白不需要 tts 属性
  - **音色 (speaker)**: **必须**从上方可用音色列表中选择，不可使用其他名称
    - 若角色有绑定音色（见下方），**必须**使用绑定的音色
    - 若无绑定，根据角色性格匹配合适的音色（如温柔角色用"桃夭"，成熟角色用"顾姐"）
  - **情感 (emotion)**: 支持中文或英文
    - 中文: 开心、悲伤、生气、惊讶、恐惧、厌恶、激动、冷漠、中性、沮丧、撒娇、害羞、安慰、鼓励、咆哮、焦急、温柔、讲故事、自然讲述、情感电台、磁性、广告营销、气泡音、低语、新闻播报、娱乐八卦、方言、对话、闲聊、温暖、深情、权威
    - 英文: happy, sad, angry, surprised, fear, hate, excited, coldness, neutral, depressed, lovey-dovey, shy, comfort, tension, tender, storytelling, radio, magnetic, advertising, vocal-fry, asmr, news, entertainment, dialect, chat, warm, affectionate, authoritative
  - **语气提示 (context)**: 可选，如"用更委屈的语气"、"放慢一点，压低音量"
  - **标点辅助**: ……拖长、犹豫；！有力、激动；？疑问、上扬；～撒娇、轻快
- **示例**:
  - \`<p tts="speaker=桃夭;emotion=温柔">少女: "你好呀～"</p>\`
  - \`<p tts="speaker=夜枭;emotion=authority">将军: "退下！"</p>\`
  - \`<p tts="speaker=顾姐;emotion=asmr;context=贴在耳边轻声">姐姐: "来嘛……陪我喝一杯～"</p>\`
  - \`<p tts="speaker=可莉;emotion=开心">女孩: "太好啦！"</p>\`
${charVoiceBindingText}

### 背景音乐 (BGM)
- **格式**: \`<bgm>当前bgm:歌名</bgm>\`
- **使用规则**:
  - **主动监测**: 必须根据剧情的发展、场景的气氛变化（如战斗、日常、悲伤、恐怖），**主动**输出适合的BGM标签。
  - **真实曲名**: AI必须根据知识库中真实存在的、适合当前场景的BGM，**直接输入真实存在的bgm歌曲名称**。
  - **时机**:
    - 场景切换时。
    - 剧情发生重大转折时。
    - 情感基调剧烈变化时。
  - **示例**:
    - 日常场景: \`<bgm>歌曲名</bgm>\`
    - 战斗开始: \`<bgm>歌曲名</bgm>\`
    - 悲剧时刻: \`<bgm>歌曲名</bgm>\`

### 背景标签 (场景环境强制)
- 格式: \`<background scene="场景名" />\`
- **使用规则**:
  - **强制触发**: 每次场景切换或环境改变时，**必须**立即输出背景标签。
  - **初始环境**: 故事开始的第一段回复中**必须**包含背景标签。
  - **持续监测**: 必须时刻关注剧情中的地点变化，一旦发生移动立即更新背景。
  - **宁滥勿缺**: 如果不确定当前背景是否正确，请再次输出背景标签以确保同步。
- ${sceneListText}

## 输出结构示例
\`\`\`
<maintext>
  <background scene="${exampleScene}" />
  <bgimg>rainy night, neon lights, wet pavement reflections, cyberpunk city, dark atmosphere, street lamps, urban scenery, night scene, detailed background</bgimg>

  <p>第一句旁白描述。（旁白无需TTS）</p>
  <p tts="emotion=开心">角色名: "这是角色的对话内容。"<微笑></p>
  <bgm>日常 轻松 OST</bgm>
  <p>继续旁白描述。（旁白无需TTS）</p>
  <p tts="speaker=角色名;emotion=惊讶">角色名: "表情变化了！"<惊讶></p>
  <p tts="emotion=温柔;context=轻声细语">角色名: "又说了一句。"<思考></p>

</maintext>
\`\`\`

## 重要提醒
1. 角色说话时必须使用格式: \`角色名: "对话内容"<表情名>\`
2. 表情标签直接跟在对话引号后面，无空格
3. 旁白不需要表情标签和TTS属性
4. maintext标签包裹所有游戏内容
5. **TTS配音**: 角色对话建议使用 tts 属性增强表现力，旁白不需要
   - 如果未指定speaker，默认使用角色名作为音色
   - 可在插件设置中配置默认音色（ttsDefaultSpeaker）作为回退
6. 每个对话段落独立配置TTS，情绪转折点另起新段落
${extraRule}
`;
    });
  }
  // 顶层窗口引用
  const topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
  const $ = topWindow.jQuery || window.jQuery;
  // 状态
  let db = null;
  const characterSprites = new Map(); // characterId_expression -> blobUrl
  const sceneBackgrounds = new Map(); // sceneName -> blobUrl
  const messageSegmentState = new Map(); // mesId -> { currentIndex, segments, parsedContent }
  // 选项面板状态
  let lastGalgameOptionHash = null; // 上一次选项内容的Hash指纹
  let galgameChoicesVisible = false; // 选项面板是否可见
  let pendingOptions = null; // 待选择的选项（用于提示按钮重新打开）
  // 设置存储键
  const SETTINGS_STORAGE_KEY = `${SCRIPT_ID}_settings`;
  const CHAR_ENABLED_STORAGE_KEY = `${SCRIPT_ID}_char_enabled`;
  const CUSTOM_EXPRESSIONS_STORAGE_KEY = `${SCRIPT_ID}_custom_expressions`;
  // 自定义HTML存储键
  const CUSTOM_LOCATION_HTML_KEY = `${SCRIPT_ID}_custom_location_html`;
  const CUSTOM_TIME_HTML_KEY = `${SCRIPT_ID}_custom_time_html`;
  // ComfyUI 相关存储键
  const COMFYUI_SETTINGS_KEY = `${SCRIPT_ID}_comfyui_settings`;
  const COMFY_WORKFLOWS_KEY = `${SCRIPT_ID}_comfy_workflows`;
  const CHAR_APPEARANCE_PROMPTS_KEY = `${SCRIPT_ID}_char_appearance_prompts`;

  // ComfyUI 默认设置
  const DEFAULT_COMFYUI_SETTINGS = {
    apiUrl: 'http://127.0.0.1:8188',
    defaultCharWorkflow: 'default_char',
    defaultBgWorkflow: 'default_bg',
    steps: 20,
    cfgScale: 7,
    width: 512,
    height: 768,
    negativePrompt: 'lowres, bad anatomy, bad hands, text, error, missing fingers',
  };
  // 默认设置 (全局)
  const DEFAULT_SETTINGS = {
    // 文本显示
    fontSize: 18, // 14-24px
    dialogOpacity: 0.95, // 0.5-1.0
    // 自动播放
    autoPlaySpeed: 2, // 1-8秒
    // 显示设置
    showSprites: true, // 显示立绘
    hideOtherFloors: true, // 沉浸模式（隐藏其他楼层）
    fullscreenMode: false, // 全屏模式
    // 立绘设置
    spriteScale: 100, // 立绘大小 50-150%
    spriteBottomOffset: 20, // 立绘底部偏移 0-50%
    spriteSpacing: 20, // 立绘间距 0-20%
    // 说话者效果
    speakerGlow: true, // 说话者光晕效果
    speakerBubble: true, // 漫画式气泡指示器
    // 快捷键
    spaceKeyNext: true, // 空格键��一句
    enterKeyNext: true, // 回车键下一句
    // 快进设置
    skipSpeed: 0.05, // 快进速度 (秒)
    ctrlKeySkip: true, // 长按Ctrl快进
    // 智能检测
    smartDetection: false, // 是否智能检测内容才显示界面
    // ComfyUI 设置
    comfyui: Object.assign({}, DEFAULT_COMFYUI_SETTINGS),
    // ComfyUI
    defaultCheckpoint: '', // 默认模型
    realTimeBackgroundGen: false, // 实时背景生成
    // TTS 设置
    ttsEnabled: true, // 是否启用TTS
    ttsAutoPlay: true, // 是否自动播放
    ttsDefaultSpeaker: '', // 默认TTS音色（空则使用角色名）
  };
  // 当前设置 (全局)
  let settings = Object.assign({}, DEFAULT_SETTINGS);
  // ============================================
  // BGM 管理器 (Music.js 集成)
  // ============================================
  const BGMManager = {
    audio: new Audio(),
    currentKeyword: null, // 当前播放的关键词
    currentTrack: null, // { Name, Singer, Url, ... }
    cache: new Map(), // keyword -> track info
    isLoaded: false,
    volume: 0.5,
    isPlaying: false,

    // 追踪正在生成的场景，避免重复触发
    generatingScenes: new Set(),
    init() {
      return __awaiter(this, void 0, void 0, function* () {
        // 恢复音量设置
        const savedVol = localStorage.getItem(`${SCRIPT_ID}_bgm_volume`);
        if (savedVol !== null) {
          this.volume = parseFloat(savedVol);
          this.audio.volume = this.volume;
        }
        // 加载外部库
        if (!globalThis.Music) {
          yield this.loadExternalScript('https://drive.baibai.cv/f/ZKEBuW/Music.js');
        }
        this.isLoaded = true;
        console.log(`[${SCRIPT_NAME}] BGMManager 初始化完成`);
        this.audio.addEventListener('ended', () => {
          // 循环播放
          this.audio.currentTime = 0;
          this.audio.play().catch(e => console.warn('BGM Replay failed:', e));
        });
        this.audio.addEventListener('error', e => {
          console.error('BGM Error:', e);
          showToast('BGM播放出错');
          this.isPlaying = false;
          this.updateUI();
        });
      });
    },
    loadExternalScript(src) {
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    },
    play(keyword) {
      return __awaiter(this, void 0, void 0, function* () {
        if (!this.isLoaded || !keyword) return;
        if (this.currentKeyword === keyword && this.isPlaying) return; // 已经在播了
        // 优化关键词：如果没有 OST 或 BGM，且不是指名道姓的歌，就追加 OST
        let searchQuery = keyword;
        if (!/ost|bgm|piano|orchestra/i.test(searchQuery)) {
          searchQuery += ' OST';
        }
        console.log(`[${SCRIPT_NAME}] BGM 搜索: ${searchQuery}`);
        this.currentKeyword = keyword;
        // 检查缓存
        let track = this.cache.get(searchQuery);
        if (!track) {
          showToast(`正在搜索BGM: ${keyword}...`);
          try {
            // 调用 Music.js (可能会失败，需要 try-catch)
            track = yield globalThis.Music.SearchMusic(searchQuery);
          } catch (e) {
            console.error('Music.SearchMusic error:', e);
          }
          if (track && track.Url) {
            this.cache.set(searchQuery, track);
          } else {
            showToast(`未找到BGM: ${keyword}`);
            return;
          }
        }
        if (track && track.Url) {
          this.currentTrack = track;
          this.audio.src = track.Url;
          this.audio.volume = this.volume;
          try {
            yield this.audio.play();
            this.isPlaying = true;
            console.log(`[${SCRIPT_NAME}] Current Track:`, track);
            showToast(`播放BGM: ${track.Name || track.name || keyword}`);
          } catch (e) {
            console.warn('播放失败（可能是需要交互）:', e);
            this.isPlaying = false;
          }
          this.updateUI();
        }
      });
    },
    pause() {
      this.audio.pause();
      this.isPlaying = false;
      this.updateUI();
    },
    resume() {
      if (this.audio.src) {
        this.audio.play().catch(e => console.error(e));
        this.isPlaying = true;
        this.updateUI();
      }
    },
    setVolume(vol) {
      this.volume = Math.max(0, Math.min(1, vol));
      this.audio.volume = this.volume;
      localStorage.setItem(`${SCRIPT_ID}_bgm_volume`, this.volume);
    },
    // UI 更新回调 (将被 overwrite)
    updateUI() {},
  };
  // ============================================
  // TTS 管理器 (LittleWhiteBox 集成)
  // ============================================
  const TTSManager = {
    enabled: true,
    autoPlay: true, // 是否自动播放
    isPlaying: false, // 当前是否正在播放
    isLoading: false, // 是否正在加载TTS
    currentAudio: null, // 当前音频对象
    currentSegmentId: null, // 当前播放的段落ID
    littleWhiteBox: null, // LittleWhiteBox 引用

    /**
     * 初始化 TTS 管理器
     */
    init() {
      // 检测 xiaobaixTts（LittleWhiteBox 的 TTS 对象）
      if (topWindow.xiaobaixTts) {
        this.xiaobaixTts = topWindow.xiaobaixTts;
        console.log(`[${SCRIPT_NAME}] TTSManager: 已连接到 xiaobaixTts`);
      }
      // 尝试获取 LittleWhiteBox 引用（备用）
      else if (topWindow.LittleWhiteBox) {
        this.littleWhiteBox = topWindow.LittleWhiteBox;
        console.log(`[${SCRIPT_NAME}] TTSManager: 已连接到 LittleWhiteBox`);
      }

      if (!this.xiaobaixTts && !this.littleWhiteBox) {
        console.warn(`[${SCRIPT_NAME}] TTSManager: 未找到 xiaobaixTts/LittleWhiteBox，将禁用TTS`);
        this.enabled = false;
      }

      // 监听 TTS 完成事件
      $(topWindow).on('tts_complete tts_end', () => {
        this.isPlaying = false;
        this.isLoading = false;
        this.currentAudio = null;
        this.hideLoadingIndicator();
      });
    },

    /**
     * 显示TTS加载指示器
     */
    showLoadingIndicator() {
      const $overlay = $('#gal-global-overlay');
      if ($overlay.length === 0) return;

      let $indicator = $overlay.find('.gal-tts-loading');
      if ($indicator.length === 0) {
        $indicator = $(
          '<div class="gal-tts-loading"><i class="fa-solid fa-volume-high fa-bounce"></i><span>配音中...</span></div>',
        );
        $overlay.find('.gal-text-panel').append($indicator);
      }
      $indicator.addClass('active');
    },

    /**
     * 隐藏TTS加载指示器
     */
    hideLoadingIndicator() {
      const $overlay = $('#gal-global-overlay');
      $overlay.find('.gal-tts-loading').removeClass('active');
    },

    /**
     * ★ 核心：中止当前播放
     */
    stop() {
      // 如果没有在播放或加载，直接返回
      if (!this.isPlaying && !this.isLoading) return;

      console.log(`[${SCRIPT_NAME}] TTS: 中止当前播放`);

      try {
        // 方式1: 使用 xiaobaixTts.player 的方法（主要方式）
        if (this.xiaobaixTts && this.xiaobaixTts.player) {
          const player = this.xiaobaixTts.player;
          // 1.1 停止当前播放（使用 _stopCurrent）
          if (typeof player._stopCurrent === 'function') {
            player._stopCurrent();
          }
          // 1.2 清空播放队列
          if (typeof player.clear === 'function') {
            player.clear();
            console.log(`[${SCRIPT_NAME}] TTS: 已清空播放队列`);
          }
        }
        // 方式2: 尝试调用 xiaobaixTts.stop（如果存在）
        else if (this.xiaobaixTts && typeof this.xiaobaixTts.stop === 'function') {
          this.xiaobaixTts.stop();
        }
        // 方式3: 尝试调用 LittleWhiteBox 的停止方法
        else if (this.littleWhiteBox && typeof this.littleWhiteBox.stop === 'function') {
          this.littleWhiteBox.stop();
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] TTS: 停止播放失败`, e);
      }

      // 重置所有状态
      this.isPlaying = false;
      this.isLoading = false;
      this.currentAudio = null;
      this.currentSegmentId = null;
      this.hideLoadingIndicator();
    },

    /**
     * ★ 核心：播放单个段落（注意：调用前需要先执行 stop() 清空队列）
     * @param {object} segment - { type, speaker, text, tts }
     * @param {string} segmentId - 唯一标识，格式: `${mesId}_${index}`
     */
    async speak(segment, segmentId) {
      // ★ 自动跳过旁白，只朗读角色对话
      if (!this.enabled || !segment || segment.type !== 'dialogue') {
        if (segment && segment.type === 'narration') {
          console.log(`[${SCRIPT_NAME}] TTS: 跳过旁白 - ${segment.text.substring(0, 30)}...`);
        }
        return;
      }
      if (!segment.text) return;

      // 构建 TTS 指令
      const ttsConfig = segment.tts || {};
      // 检查角色是否有绑定的音色
      const boundVoice = getCharacterTTSVoice(segment.speaker);
      // 优先级: tts.speaker > boundVoice > settings.ttsDefaultSpeaker > '桃夭'(默认女声)
      const speaker = ttsConfig.speaker || boundVoice || settings.ttsDefaultSpeaker || '桃夭';
      const emotion = ttsConfig.emotion || '中性';
      const context = ttsConfig.context || '';

      console.log(
        `[${SCRIPT_NAME}] TTS播放: speaker=${speaker}, emotion=${emotion}, text=${segment.text.substring(0, 30)}...`,
      );

      this.isLoading = true;
      this.showLoadingIndicator();

      // 调用 xiaobaixTts/LittleWhiteBox 播放
      try {
        // 方式1: 使用 xiaobaixTts.speak（主要方式）
        if (this.xiaobaixTts && typeof this.xiaobaixTts.speak === 'function') {
          await this.xiaobaixTts.speak(segment.text, {
            speaker: speaker,
            emotion: emotion,
            context: context,
          });
          this.isPlaying = true;
          this.currentSegmentId = segmentId;
        }
        // 方式2: 使用 LittleWhiteBox.callGenerate（备用）
        else if (this.littleWhiteBox && typeof this.littleWhiteBox.callGenerate === 'function') {
          await this.littleWhiteBox.callGenerate({
            message: segment.text,
            speaker: speaker,
            emotion: emotion,
            context: context,
          });
          this.isPlaying = true;
          this.currentSegmentId = segmentId;
        } else {
          console.warn(`[${SCRIPT_NAME}] TTS: 未找到可用的 TTS 接口，请确保 LittleWhiteBox 插件已安装并启用`);
        }
      } catch (err) {
        console.error(`[${SCRIPT_NAME}] TTS播放失败:`, err);
      } finally {
        this.isLoading = false;
        this.hideLoadingIndicator();
      }
    },

    /**
     * 播放当前段落（根据 state）
     */
    speakCurrent(state) {
      if (!state || !this.autoPlay || !this.enabled) return;

      const segment = state.segments[state.currentIndex];
      if (!segment || segment.type !== 'dialogue') return;

      const segmentId = `${state.mesId || 'unknown'}_${state.currentIndex}`;
      this.speak(segment, segmentId);
    },
  };
  // 每个角色卡的开关状态 { charId: boolean }
  let charEnabledMap = {};
  // 获取当前角色卡ID
  function getCurrentCharId() {
    var _a, _b;
    try {
      const ctx =
        (_b = (_a = topWindow.SillyTavern) === null || _a === void 0 ? void 0 : _a.getContext) === null || _b === void 0
          ? void 0
          : _b.call(_a);
      if ((ctx === null || ctx === void 0 ? void 0 : ctx.characterId) !== undefined) {
        return String(ctx.characterId);
      }
    } catch (e) {}
    return 'default';
  }
  // 加载全局设置
  function loadSettings() {
    try {
      const saved = topWindow.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        settings = Object.assign(Object.assign({}, DEFAULT_SETTINGS), parsed);
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加载设置失败:`, e);
    }
    // 加载角色卡开关状态
    try {
      const savedChar = topWindow.localStorage.getItem(CHAR_ENABLED_STORAGE_KEY);
      if (savedChar) {
        charEnabledMap = JSON.parse(savedChar);
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加载角色开关状态失败:`, e);
    }
  }
  // 保存全局设置
  function saveSettings() {
    try {
      topWindow.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 保存设置失败:`, e);
    }
  }
  // 保存角色卡开关状态
  function saveCharEnabled() {
    try {
      topWindow.localStorage.setItem(CHAR_ENABLED_STORAGE_KEY, JSON.stringify(charEnabledMap));
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 保存角色开关状态失败:`, e);
    }
  }
  // 获取当前角色卡的开关状态
  function isCurrentCharEnabled() {
    const charId = getCurrentCharId();
    return charEnabledMap[charId] === true;
  }
  // 设置当前角色卡的开关状态
  function setCurrentCharEnabled(enabled) {
    const charId = getCurrentCharId();
    charEnabledMap[charId] = enabled;
    saveCharEnabled();
  }

  // ============================================
  // ComfyUI 状态与辅助函数
  // ============================================

  // 获取所有角色的外貌提示词 { characterId: promptText }
  function getCharAppearancePrompts() {
    try {
      const saved = topWindow.localStorage.getItem(CHAR_APPEARANCE_PROMPTS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加载角色外貌提示词失败:`, e);
    }
    return {};
  }

  function saveCharAppearancePrompts(prompts) {
    try {
      topWindow.localStorage.setItem(CHAR_APPEARANCE_PROMPTS_KEY, JSON.stringify(prompts));
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 保存角色外貌提示词失败:`, e);
    }
  }

  // 获取单个角色的外貌提示词
  function getCharAppearancePrompt(characterId) {
    // 如果是 'current_char'，尝试获取真实名字
    if (characterId === 'current_char') {
      const list = getCharacterListFromDatabase();
      const current = list.find(c => c.id === 'current_char');
      if (current) characterId = current.name;
    }
    const prompts = getCharAppearancePrompts();
    return prompts[characterId] || '';
  }

  // 设置单个角色的外貌提示词
  function setCharAppearancePrompt(characterId, promptText) {
    const prompts = getCharAppearancePrompts();
    prompts[characterId] = promptText;
    saveCharAppearancePrompts(prompts);
  }

  // 获取 ComfyUI 设置 (合并默认值)
  function getComfyUISettings() {
    if (!settings.comfyui) {
      settings.comfyui = Object.assign({}, DEFAULT_COMFYUI_SETTINGS);
    }
    return settings.comfyui;
  }

  function saveComfyUISettings(newSettings) {
    settings.comfyui = newSettings;
    saveSettings();
  }

  // 获取保存的工作流列表 { id: { name, json } }
  function getComfyWorkflows() {
    try {
      const saved = topWindow.localStorage.getItem(COMFY_WORKFLOWS_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加载工作流失败:`, e);
    }
    return {};
  }

  function saveComfyWorkflows(workflows) {
    try {
      topWindow.localStorage.setItem(COMFY_WORKFLOWS_KEY, JSON.stringify(workflows));
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 保存工作流失败:`, e);
    }
  }

  // ============================================
  // ComfyUI API 核心
  // ============================================

  // 尝试使用 GM_xmlhttpRequest (如果环境支持，如油猴或特定的加载器)
  function gmFetch(url, options = {}) {
    return new Promise((resolve, reject) => {
      if (typeof GM_xmlhttpRequest === 'undefined') {
        reject(new Error('GM_xmlhttpRequest is not defined'));
        return;
      }
      GM_xmlhttpRequest({
        method: options.method || 'GET',
        url: url,
        headers: options.headers || {},
        data: options.body || undefined,
        timeout: 60000,
        onload: response => {
          resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            statusText: response.statusText,
            text: () => Promise.resolve(response.responseText),
            json: () => Promise.resolve(JSON.parse(response.responseText)),
            blob: () => Promise.resolve(new Blob([response.response], { type: 'image/png' })), // 简化的 Blob 处理
          });
        },
        onerror: error => reject(new Error(error.error || 'Network Error')),
        ontimeout: () => reject(new Error('Timeout')),
      });
    });
  }

  // 智能 Fetch: 优先尝试各种特权 Fetch 以绕过 CORS
  const safeFetch = async (url, options = {}) => {
    // 1. 尝试直接使用 GM_xmlhttpRequest (如果当前是油猴脚本)
    if (typeof GM_xmlhttpRequest !== 'undefined') {
      console.log(`[${SCRIPT_NAME}] 使用原生 GM_xmlhttpRequest 请求: ${url}`);
      return gmFetch(url, options);
    }

    // 3. 普通 Fetch (受 CORS 限制)
    return fetch(url, options);
  };

  const ComfyUIAPI = {
    // 获取 ST 请求头
    getHeaders() {
      if (typeof SillyTavern !== 'undefined' && typeof SillyTavern.getRequestHeaders === 'function') {
        return { ...SillyTavern.getRequestHeaders(), 'Content-Type': 'application/json' };
      }
      return { 'Content-Type': 'application/json' };
    },

    // ST 后端代理请求助手
    async stFetch(endpoint, body) {
      console.log(`[${SCRIPT_NAME}] Proxy Request: ${endpoint}`, body);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`SillyTavern Proxy Error (${response.status}): ${errText}`);
      }
      return response;
    },

    // 检查连接 (通过尝试获取采样器)
    async checkConnection() {
      const s = getComfyUISettings();
      const baseUrl = s.apiUrl.replace(/\/$/, '');
      try {
        // 使用 /api/sd/comfy/samplers 作为连接测试
        await this.stFetch('/api/sd/comfy/samplers', { url: baseUrl });
        return true;
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] ComfyUI连接失败 (Proxy):`, e);
        return false;
      }
    },

    // 生成简易 workflow 用于兜底 (SDXL Turbo 风格)
    buildDefaultWorkflow(positive, negative, width, height, steps, cfg) {
      return {
        3: {
          inputs: {
            seed: '%seed%',
            steps: steps,
            cfg: cfg,
            sampler_name: 'euler_ancestral',
            scheduler: 'normal',
            denoise: 1,
            model: ['4', 0],
            positive: ['6', 0],
            negative: ['7', 0],
            latent_image: ['5', 0],
          },
          class_type: 'KSampler',
        },
        4: {
          inputs: { ckpt_name: 'your_model_here.safetensors' },
          class_type: 'CheckpointLoaderSimple',
        },
        5: {
          inputs: { width: width, height: height, batch_size: 1 },
          class_type: 'EmptyLatentImage',
        },
        6: {
          inputs: { text: '%prompt%', clip: ['4', 1] },
          class_type: 'CLIPTextEncode',
        },
        7: {
          inputs: { text: '%negative%', clip: ['4', 1] },
          class_type: 'CLIPTextEncode',
        },
        8: {
          inputs: { samples: ['3', 0], vae: ['4', 2] },
          class_type: 'VAEDecode',
        },
        9: {
          inputs: { filename_prefix: 'GalgameGen', images: ['8', 0] },
          class_type: 'SaveImage',
        },
      };
    },

    // 辅助：识别文本节点
    isTextNode(node) {
      if (!node) return false;
      const type = node.class_type;
      // 兼容各种常见的文本编码节点
      return (
        type === 'CLIPTextEncode' ||
        type === 'CLIPTextEncodeSDXL' ||
        type === 'ShowText' ||
        type === 'PrimitiveNode' ||
        (type && type.includes('TextEncode'))
      );
    },

    // 辅助：查找采样器节点
    findSamplerNodes(workflow) {
      const samplers = [];
      for (const id in workflow) {
        const node = workflow[id];
        if (
          node.class_type &&
          (node.class_type.includes('Sampler') || // KSampler, KSamplerAdvanced...
            node.class_type === 'KModel' || // 某些变体
            node.class_type === 'Samplers')
        ) {
          samplers.push({ id, node });
        }
      }
      return samplers;
    },

    // 辅助：从节点输入反向追踪源头
    traceBackInput(workflow, nodeId, inputName) {
      const node = workflow[nodeId];
      if (!node || !node.inputs || !node.inputs[inputName]) return null;

      const link = node.inputs[inputName];
      // ComfyUI Link 格式: ["nodeId", slotIndex]
      if (!Array.isArray(link) || link.length < 1) return null;

      const sourceId = link[0];
      const sourceNode = workflow[sourceId];
      if (!sourceNode) return null;

      return { id: sourceId, node: sourceNode };
    },

    // 注入提示词到任何 workflow
    injectPromptsToWorkflow(workflow, positive, negative, seed) {
      // =========================================================
      // Stage 1: 变量替换模式 (Variable Replacement)
      // =========================================================
      // 参考 temp_script.js 的实现，优先支持 %prompt% 等占位符

      let workflowStr = JSON.stringify(workflow);
      let hasVariables = false;

      const replacements = {
        '%prompt%': positive,
        '%negative%': negative,
        '%seed%': seed,
      };

      // 检查是否存在占位符
      for (const key in replacements) {
        if (workflowStr.includes(key)) {
          hasVariables = true;
          break;
        }
      }

      if (hasVariables) {
        console.log(`[${SCRIPT_NAME}] 使用变量替换模式注提示词 (%params%)`);

        // 特殊处理 seed: 将 "%seed%" 替换为 数字 (即去掉双引号)
        // 这样生成的 JSON 中 seed 就是数字类型而不是字符串 "12345"
        if (workflowStr.includes('"%seed%"')) {
          workflowStr = workflowStr.split('"%seed%"').join(seed);
        }

        for (const [key, value] of Object.entries(replacements)) {
          if (key === '%seed%') continue; // seed 已处理

          // 安全转义处理：如果 value 是字符串，需要转义引号和反斜杠以保证 JSON 有效性
          const safeValue = typeof value === 'string' ? value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : value;

          // 全局替换
          workflowStr = workflowStr.split(key).join(safeValue);
        }

        try {
          const newWorkflow = JSON.parse(workflowStr);
          // 原地清空并更新，保留原始对象引用
          for (const k in workflow) delete workflow[k];
          Object.assign(workflow, newWorkflow);

          return { workflow, posNodeFound: true, negNodeFound: true };
        } catch (e) {
          console.error(`[${SCRIPT_NAME}] 变量替换后 JSON 解析失败:`, e);
          // 解析失败则回退到后续模式
        }
      }

      // =========================================================
      // Stage 2: 智能拓扑追踪 (Smart Topology Tracing)
      // =========================================================
      console.log(`[${SCRIPT_NAME}] 尝试智能拓扑追踪注入...`);
      let posNodeFound = false;
      let negNodeFound = false;

      const samplers = this.findSamplerNodes(workflow);
      if (samplers.length > 0) {
        console.log(`[${SCRIPT_NAME}] 找到 ${samplers.length} 个采样器节点`);

        // 辅助递归函数：寻找真正的文本输入源
        const findTextSource = (nodeId, depth = 0) => {
          if (depth > 10) return null; // 防止死循环
          const node = workflow[nodeId];
          if (!node) return null;

          // 1. 如果当前节点就是文本节点，返回它
          if (this.isTextNode(node)) return nodeId;

          // 2. 如果是中间节点 (如 ConditioningCombine, LoraLoader 等)，尝试追踪其输入
          const inputsToCheck = ['conditioning', 'conditioning_1', 'conditioning_2', 'clip', 'samples'];
          for (const inputName of inputsToCheck) {
            const source = this.traceBackInput(workflow, nodeId, inputName);
            if (source) {
              const res = findTextSource(source.id, depth + 1);
              if (res) return res;
            }
          }
          return null;
        };

        for (const { id: samplerId, node: samplerNode } of samplers) {
          // 注入种子
          if (samplerNode.inputs) {
            if (samplerNode.inputs.seed !== undefined) samplerNode.inputs.seed = seed;
            if (samplerNode.inputs.noise_seed !== undefined) samplerNode.inputs.noise_seed = seed;
          }

          // 追踪 Positive
          const posSource = this.traceBackInput(workflow, samplerId, 'positive');
          if (posSource) {
            const targetId = findTextSource(posSource.id);
            if (targetId && workflow[targetId].inputs) {
              workflow[targetId].inputs.text = positive;
              console.log(`[${SCRIPT_NAME}] 自动追踪并注入 Positive -> Node ${targetId}`);
              posNodeFound = true;
            }
          }

          // 追踪 Negative
          const negSource = this.traceBackInput(workflow, samplerId, 'negative');
          if (negSource) {
            const targetId = findTextSource(negSource.id);
            if (targetId && workflow[targetId].inputs) {
              workflow[targetId].inputs.text = negative;
              console.log(`[${SCRIPT_NAME}] 自动追踪并注入 Negative -> Node ${targetId}`);
              negNodeFound = true;
            }
          }
        }
      }

      if (posNodeFound || negNodeFound) {
        return { workflow, posNodeFound, negNodeFound };
      }

      // =========================================================
      // Stage 3: 旧版启发式兜底 (Legacy Fallback)
      // =========================================================
      console.log(`[${SCRIPT_NAME}] 拓扑追踪失败，使用列表顺序兜底...`);

      // 1. 尝试查找 CLIPTextEncode (手动查找，不再依赖 textNodes 数组构建逻辑)
      const textNodes = [];
      for (const id in workflow) {
        if (this.isTextNode(workflow[id])) {
          textNodes.push(workflow[id]);
        }
        // 注入随机种子 (兜底)
        if (
          workflow[id].inputs &&
          (workflow[id].inputs.seed !== undefined || workflow[id].inputs.noise_seed !== undefined)
        ) {
          if (typeof workflow[id].inputs.seed === 'number') workflow[id].inputs.seed = seed;
        }
      }

      if (textNodes.length >= 1) {
        textNodes[0].inputs.text = positive;
        posNodeFound = true;
      }
      if (textNodes.length >= 2) {
        textNodes[1].inputs.text = negative;
        negNodeFound = true;
      }

      return { workflow, posNodeFound, negNodeFound };
    },

    // 获取可用模型列表 (通过 ST 代理)
    async getModels(baseUrl) {
      try {
        console.log(`[${SCRIPT_NAME}] 正在获取模型列表 (Proxy)...`);
        // ST API: /api/sd/comfy/models
        const response = await this.stFetch('/api/sd/comfy/models', { url: baseUrl });
        const rawData = await response.json();

        // 兼容处理：ST 有时返回字符串数组，有时可能返回对象数组 (如果安装了某些插件)
        // 统一转换为字符串数组 (filenames)
        const models = rawData.map(m => {
          if (typeof m === 'string') return m;
          if (m && typeof m === 'object') return m.value || m.title || m.filename || m.name || JSON.stringify(m);
          return String(m);
        });

        console.log(`[${SCRIPT_NAME}] 获取到 ${models.length} 个模型`);
        return models;
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 获取模型列表异常 (Proxy):`, e);
        return [];
      }
    },

    // 执行生成 (通过 ST 代理)
    async generate(workflowJson, promptText, negativeText, extraSettings = {}) {
      const s = getComfyUISettings();
      const baseUrl = s.apiUrl.replace(/\/$/, '');
      const seed = Math.floor(Math.random() * 10000000000000);
      const { checkpointOverride } = extraSettings; // 支持从外部传入模型名称

      // 格式检查：防止用户使用 UI 格式的 JSON
      if (workflowJson.nodes && Array.isArray(workflowJson.nodes) && workflowJson.version !== undefined) {
        console.error(`[${SCRIPT_NAME}] 错误: 检测到 UI 格式 Workflow`);
        throw new Error(
          "格式错误: 检测到您使用的是 'Save' 保存的 UI 格式 JSON。请在 ComfyUI 设置中开启 'Enable Dev mode Options'，然后使用 'Save (API Format)' 按钮保存 Workflow。",
        );
      }
      // 简单的 API 格式检查 (必须是对象且没有 nodes 数组)
      if (typeof workflowJson !== 'object' || Array.isArray(workflowJson)) {
        throw new Error('格式错误: Workflow 必须是 API 格式的 JSON 对象 (Key 为节点ID)。');
      }

      let finalWorkflow = JSON.parse(JSON.stringify(workflowJson)); // Deep clone

      // 查找模型加载节点
      let checkpointNode = null;
      for (const id in finalWorkflow) {
        const node = finalWorkflow[id];
        if ((node.class_type === 'CheckpointLoaderSimple' || node.class_type === 'CheckpointLoader') && node.inputs) {
          checkpointNode = node;
          break;
        }
      }

      // 1. 如果指定了 override，强制替换
      if (checkpointOverride && checkpointNode) {
        console.log(`[${SCRIPT_NAME}] 使用指定模型覆盖: ${checkpointOverride}`);
        checkpointNode.inputs.ckpt_name = checkpointOverride;
      }
      // 2. 否则检查是否有占位符需要自动修复
      else if (checkpointNode && checkpointNode.inputs.ckpt_name === 'your_model_here.safetensors') {
        console.log(`[${SCRIPT_NAME}] 检测到占位符模型，尝试自动替换...`);
        try {
          const models = await this.getModels(baseUrl); // 使用代理获取
          if (models && models.length > 0) {
            // 查找 SDXL 模型 (不区分大小写)
            const sdxl = models.find(m => typeof m === 'string' && m.toLowerCase().includes('sdxl'));
            checkpointNode.inputs.ckpt_name = sdxl || models[0];
            console.log(`[${SCRIPT_NAME}] 自动替换模型为: ${checkpointNode.inputs.ckpt_name}`);
          } else {
            throw new Error('模型列表为空');
          }
        } catch (e) {
          console.error(`[${SCRIPT_NAME}] 自动替换失败:`, e);
        }
      }

      // 注入提示词 (in-place modification)
      this.injectPromptsToWorkflow(finalWorkflow, promptText, negativeText, seed);

      // 发送请求 (通过 ST 代理)
      const clientId = 'galgame_client_' + Date.now();
      console.log(`[${SCRIPT_NAME}] 发送生成请求到 Proxy /api/sd/comfy/generate...`);

      // 构造 ST代理 需要的 Prompt 结构
      const comfyPrompt = {
        client_id: clientId,
        prompt: finalWorkflow,
      };

      const response = await this.stFetch('/api/sd/comfy/generate', {
        url: baseUrl,
        prompt: JSON.stringify(comfyPrompt), // ST 要求 prompt 字段是 JSON 字符串
      });

      const result = await response.json();

      // ST 代理直接返回 Base64 数据
      if (result.data) {
        const base64Data = result.data.split(',').pop(); // 确保去掉 data:image/png;base64, 前缀
        // 转换为 Blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: 'image/png' });
      } else {
        throw new Error('SillyTavern代理返回了空数据');
      }
    },
  };

  // ============================================
  // 自定义表情管理
  // ============================================

  // 获取自定义表情列表
  function getCustomExpressions() {
    try {
      const saved = topWindow.localStorage.getItem(CUSTOM_EXPRESSIONS_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 加载自定义表情失败:`, e);
    }
    return [];
  }

  // 保存自定义表情列表
  function saveCustomExpressions(expressions) {
    try {
      topWindow.localStorage.setItem(CUSTOM_EXPRESSIONS_STORAGE_KEY, JSON.stringify(expressions));
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 保存自定义表情失败:`, e);
    }
  }

  // 添加自定义表情（自动更新COT）
  function addCustomExpression(name) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!name || typeof name !== 'string') return false;

      const trimmedName = name.trim();
      if (!trimmedName) return false;

      // 检查是否与预设表情重复
      if (EXPRESSION_LIST.includes(trimmedName)) {
        showToast(`"${trimmedName}" 是预设表情，无需添加`);
        return false;
      }

      const customs = getCustomExpressions();

      // 检查是否已存在
      if (customs.includes(trimmedName)) {
        showToast(`"${trimmedName}" 已存在`);
        return false;
      }

      customs.push(trimmedName);
      saveCustomExpressions(customs);

      // 自动更新 COT
      if (isEnabled) {
        yield injectCOTToWorldbook();
      }

      showToast(`已添加表情: ${trimmedName}`);
      return true;
    });
  }

  // 删除自定义表情（自动更新COT）
  function removeCustomExpression(name) {
    return __awaiter(this, void 0, void 0, function* () {
      const customs = getCustomExpressions();
      const index = customs.indexOf(name);

      if (index === -1) {
        showToast(`"${name}" 不存在`);
        return false;
      }

      customs.splice(index, 1);
      saveCustomExpressions(customs);

      // 自动更新 COT
      if (isEnabled) {
        yield injectCOTToWorldbook();
      }

      showToast(`已删除表情: ${name}`);
      return true;
    });
  }

  // 获取完整表情列表（预设 + 自定义）
  function getAllExpressions() {
    const customs = getCustomExpressions();
    return [...EXPRESSION_LIST, ...customs];
  }
  // 兼容旧变量
  let isEnabled = false;
  let hideOtherFloors = false;
  // 快进状态
  let isSkipping = false;
  let skipTimer = null;
  // 快退状态
  let isRewinding = false;
  let rewindTimer = null;
  let rewindHoldTimer = null;
  const REWIND_HOLD_DELAY = 3000; // 3秒长按
  // ============================================
  // 数据库集成 - 从AutoCardUpdaterAPI获取角色列表
  // ============================================
  function getCharacterListFromDatabase() {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const characters = [];
    try {
      // 1. 首先尝试从当前角色卡获取角色名
      const charName =
        (_h =
          (_d =
            (_c =
              (_b = (_a = topWindow.SillyTavern) === null || _a === void 0 ? void 0 : _a.getContext) === null ||
              _b === void 0
                ? void 0
                : _b.call(_a)) === null || _c === void 0
              ? void 0
              : _c.characters) === null || _d === void 0
            ? void 0
            : _d[
                (_g =
                  (_f = (_e = topWindow.SillyTavern) === null || _e === void 0 ? void 0 : _e.getContext) === null ||
                  _f === void 0
                    ? void 0
                    : _f.call(_e)) === null || _g === void 0
                  ? void 0
                  : _g.characterId
              ]) === null || _h === void 0
          ? void 0
          : _h.name;
      if (charName) {
        characters.push({
          id: 'current_char',
          name: charName,
          type: '当前角色',
          source: '角色卡',
        });
        console.log(`[${SCRIPT_NAME}] 从角色卡获取: ${charName}`);
      }
      // 2. 尝试获取AutoCardUpdaterAPI
      const api = topWindow.AutoCardUpdaterAPI;
      if (!api || typeof api.exportTableAsJson !== 'function') {
        console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 未找到或未初始化`);
        return characters;
      }
      const tableData = api.exportTableAsJson();
      if (!tableData || typeof tableData !== 'object') {
        console.log(`[${SCRIPT_NAME}] 表格数据为空`);
        return characters;
      }
      // 主角相关表名和列名变体
      const protagonistSheets = ['主角信息', '主角', '玩家信息', 'User', 'user', '用户'];
      const protagonistNameCols = ['人物名称', '姓名', '名字', '角色名', 'name', 'Name'];
      // NPC相关表名和列名变体
      const npcSheets = ['重要人物表', '重要人物', 'NPC', 'npc', '角色列表', '人物列表'];
      const npcNameCols = ['姓名', '人物名称', '角色名', '名字', 'name', 'Name'];
      // 遍历所有表格查找角色信息
      Object.keys(tableData).forEach(sheetKey => {
        if (!sheetKey.startsWith('sheet_')) return;
        const sheet = tableData[sheetKey];
        const sheetName = (sheet === null || sheet === void 0 ? void 0 : sheet.name) || '';
        const content = (sheet === null || sheet === void 0 ? void 0 : sheet.content) || [];
        if (content.length < 2) return;
        const headers = content[0] || [];
        // 查找名称列
        const findNameColumn = cols => {
          for (const col of cols) {
            const idx = headers.indexOf(col);
            if (idx !== -1) return idx;
          }
          return -1;
        };
        // 检查是否是主角表
        if (protagonistSheets.includes(sheetName)) {
          const nameColIndex = findNameColumn(protagonistNameCols);
          if (nameColIndex !== -1) {
            for (let i = 1; i < content.length; i++) {
              const row = content[i];
              const name = row === null || row === void 0 ? void 0 : row[nameColIndex];
              if (name && typeof name === 'string' && name.trim()) {
                characters.push({
                  id: `protagonist_${i}`,
                  name: name.trim(),
                  type: '主角',
                  source: sheetName,
                });
              }
            }
          }
        }
        // 检查是否是NPC表
        if (npcSheets.includes(sheetName)) {
          const nameColIndex = findNameColumn(npcNameCols);
          if (nameColIndex !== -1) {
            for (let i = 1; i < content.length; i++) {
              const row = content[i];
              const name = row === null || row === void 0 ? void 0 : row[nameColIndex];
              if (name && typeof name === 'string' && name.trim()) {
                // 避免重复
                if (!characters.find(c => c.name === name.trim())) {
                  characters.push({
                    id: `npc_${i}`,
                    name: name.trim(),
                    type: 'NPC',
                    source: sheetName,
                  });
                }
              }
            }
          }
        }
      });
      console.log(
        `[${SCRIPT_NAME}] 从数据库获取到 ${characters.length} 个角色:`,
        characters.map(c => c.name),
      );
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 获取角色列表失败:`, e);
    }
    return characters;
  }

  // ============================================
  // 从全局数据表获取地点和时间信息
  // ============================================
  function getGlobalLocationAndTime() {
    const result = {
      primaryRegion: '', // 当前主要地区
      secondaryRegion: '', // 当前次要地区
      detailedLocation: '', // 当前详细地点
      currentTime: '', // 当前时间
    };

    try {
      const api = topWindow.AutoCardUpdaterAPI;
      if (!api || typeof api.exportTableAsJson !== 'function') {
        console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 未找到或未初始化`);
        return result;
      }

      const tableData = api.exportTableAsJson();
      if (!tableData || typeof tableData !== 'object') {
        console.log(`[${SCRIPT_NAME}] 表格数据为空`);
        return result;
      }

      // 打印所有表名，用于调试
      const availableSheets = Object.values(tableData)
        .map(s => `${s.name}(${s.uid})`)
        .join(', ');
      console.log(`[${SCRIPT_NAME}] 可用表格: ${availableSheets}`);

      // 全局数据表名变体
      const globalSheets = ['全局数据表', '全局数据', '全局变量', 'Global', 'global'];

      // 列名映射
      const columnMappings = {
        primaryRegion: ['当前主要地区', '主要地区', '主地区'],
        secondaryRegion: ['当前次要地区', '次要地区', '副地区'],
        detailedLocation: ['当前详细地点', '详细地点', '具体地点', '地点'],
        currentTime: ['当前时间', '时间', '游戏时间'],
      };

      // 遍历所有表格查找全局数据表
      let targetSheet = null;

      // 策略1: 优先通过 UID 查找
      for (const key of Object.keys(tableData)) {
        if (tableData[key]?.uid === 'sheet_global_data') {
          targetSheet = tableData[key];
          console.log(`[${SCRIPT_NAME}] 通过UID找到全局表: ${targetSheet.name}`);
          break;
        }
      }

      // 策略2: 如果UID未找到，通过名称查找
      if (!targetSheet) {
        for (const key of Object.keys(tableData)) {
          const sheet = tableData[key];
          if (sheet && globalSheets.includes(sheet.name)) {
            targetSheet = sheet;
            console.log(`[${SCRIPT_NAME}] 通过名称找到全局表: ${sheet.name}`);
            break;
          }
        }
      }

      if (targetSheet) {
        const content = targetSheet.content || [];
        if (content.length >= 2) {
          const headers = content[0] || [];
          const dataRow = content[1] || []; // 数据在第二行

          console.log(`[${SCRIPT_NAME}] 全局表头:`, headers);
          console.log(`[${SCRIPT_NAME}] 全局数据:`, dataRow);

          // 查找各个字段的列索引并获取值
          for (const [field, columnNames] of Object.entries(columnMappings)) {
            for (const colName of columnNames) {
              // 模糊匹配列名（去除空格）
              const colIndex = headers.findIndex(h => h && String(h).trim() === colName);

              if (colIndex !== -1 && dataRow[colIndex]) {
                result[field] = String(dataRow[colIndex]).trim();
                break;
              }
            }
          }
        } else {
          console.log(`[${SCRIPT_NAME}] 全局表内容行数不足: ${content.length}`);
        }
      } else {
        console.log(`[${SCRIPT_NAME}] 未找到全局数据表`);
      }

      console.log(`[${SCRIPT_NAME}] 最终获取地点时间结果:`, result);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 获取全局地点时间失败:`, e);
    }

    return result;
  }

  /**
   * 更新地点和时间状态栏显示
   * @param {number} retryCount - 当前重试次数
   */
  function updateLocationTimeDisplay(retryCount = 0) {
    const data = getGlobalLocationAndTime();
    const $locationText = $('#gal-location-text');
    const $timeText = $('#gal-time-text');
    const $locationBar = $('#gal-location-bar');
    const $timeBar = $('#gal-time-bar');

    // 检查数据是否有效 (简单的有效性检查: 是否所有字段都为空)
    const isEmpty = !data.primaryRegion && !data.secondaryRegion && !data.detailedLocation && !data.currentTime;

    if (isEmpty && retryCount < 10) {
      console.log(`[${SCRIPT_NAME}] 全局数据为空，将在 1秒后重试 (${retryCount + 1}/10)...`);
      setTimeout(() => updateLocationTimeDisplay(retryCount + 1), 1000);
      return;
    }

    // 构建地点显示文本（空字段跳过）
    const locationParts = [];
    if (data.primaryRegion) locationParts.push(data.primaryRegion);
    if (data.secondaryRegion) locationParts.push(data.secondaryRegion);
    if (data.detailedLocation) locationParts.push(data.detailedLocation);

    const locationText = locationParts.join(' -- ') || '未知地点';
    const timeText = data.currentTime || '--';

    // 更新文本内容
    $locationText.text(locationText);
    $timeText.text(timeText);

    // 更新 title 属性（鼠标悬停显示完整文本）
    $locationBar.attr('title', locationText);
    $timeBar.attr('title', timeText);

    // 自动缩小过长文字
    // 允许的文字最大宽度 = 容器最大宽度 - padding(30) - icon(20) - buffer(10)
    autoShrinkText($locationText, 290);
    autoShrinkText($timeText, 200);

    console.log(`[${SCRIPT_NAME}] 更新地点时间显示: ${locationText} | ${timeText}`);
  }

  /**
   * 自动缩小过长文字
   * @param {jQuery} $element - 文字元素
   * @param {number} maxWidth - 最大宽度
   */
  function autoShrinkText($element, maxWidth) {
    if (!$element.length) return;

    // 先清除之前的 style 以便重新测量
    $element.removeAttr('style');

    // 获取实际宽度
    const actualWidth = $element.width(); // 或 outerWidth(true)

    if (actualWidth > maxWidth) {
      const scale = maxWidth / actualWidth;
      // 最小缩放到 0.5，保证可读性
      const finalScale = Math.max(0.5, scale);

      $element.css({
        transform: `scaleX(${finalScale})`,
        'transform-origin': 'left center',
        width: `${actualWidth}px`, // 锁定宽度，防止布局坍塌
      });

      // 如果缩放后依然超出（因为有最小缩放限制），则让父容器 overflow:hidden 截断
    }
  }
  // ============================================
  // IndexedDB 立绘存储
  // ============================================
  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        db = request.result;
        console.log(`[${SCRIPT_NAME}] IndexedDB 初始化成功`);
        resolve(db);
      };
      request.onupgradeneeded = event => {
        const database = event.target.result;
        // 立绘存储
        if (!database.objectStoreNames.contains(STORE_SPRITES)) {
          const store = database.createObjectStore(STORE_SPRITES, { keyPath: 'id' });
          store.createIndex('characterId', 'characterId', { unique: false });
          store.createIndex('expression', 'expression', { unique: false });
        }
        // 背景存储
        if (!database.objectStoreNames.contains(STORE_BACKGROUNDS)) {
          const bgStore = database.createObjectStore(STORE_BACKGROUNDS, { keyPath: 'id' });
          bgStore.createIndex('sceneName', 'sceneName', { unique: true });
        }
      };
    });
  }
  // 保存立绘
  function saveSprite(characterId_1, expression_1, imageBlob_1) {
    return __awaiter(this, arguments, void 0, function* (characterId, expression, imageBlob, imageUrl = null) {
      if (!db) yield initDB();
      return new Promise((resolve, reject) => {
        const id = `${characterId}_${expression}`;

        // ★ 先撤销旧的 blob URL（如果存在且是 blob: 类型）
        const oldBlobUrl = characterSprites.get(id);
        if (oldBlobUrl && oldBlobUrl.startsWith('blob:')) {
          try {
            (topWindow.URL || URL).revokeObjectURL(oldBlobUrl);
            console.log(`[${SCRIPT_NAME}] 已撤销旧的 blob URL: ${id}`);
          } catch (e) {
            console.warn(`[${SCRIPT_NAME}] 撤销旧 blob URL 失败:`, e);
          }
        }
        // ★ 立即从缓存中删除旧记录，确保后续能获取新数据
        characterSprites.delete(id);

        const transaction = db.transaction([STORE_SPRITES], 'readwrite');
        const store = transaction.objectStore(STORE_SPRITES);
        const data = {
          id,
          characterId,
          expression,
          imageBlob,
          imageUrl,
          lastModified: new Date().toISOString(),
        };
        const request = store.put(data);
        request.onsuccess = () => {
          // 更新缓存
          let blobUrl;
          if (imageUrl) {
            blobUrl = imageUrl;
          } else if (imageBlob) {
            // ★ 使用 topWindow.URL
            blobUrl = (topWindow.URL || URL).createObjectURL(imageBlob);
          }
          if (blobUrl) {
            characterSprites.set(id, blobUrl);
          }
          console.log(`[${SCRIPT_NAME}] 立绘已保存: ${id}`);
          resolve(blobUrl);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // 批量保存立绘
  function saveSpritesBatch(spritesList) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!spritesList || spritesList.length === 0) return;
      if (!db) yield initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SPRITES], 'readwrite');
        const store = transaction.objectStore(STORE_SPRITES);

        transaction.oncomplete = () => {
          console.log(`[${SCRIPT_NAME}] 批量保存立绘完成: ${spritesList.length} 个`);
          resolve();
        };

        transaction.onerror = event => {
          console.error(`[${SCRIPT_NAME}] 批量保存立绘失败:`, event.target.error);
          reject(event.target.error);
        };

        spritesList.forEach(item => {
          const id = `${item.characterId}_${item.expression}`;

          // ★ 先撤销旧的 blob URL（如果存在且是 blob: 类型）
          const oldBlobUrl = characterSprites.get(id);
          if (oldBlobUrl && oldBlobUrl.startsWith('blob:')) {
            try {
              (topWindow.URL || URL).revokeObjectURL(oldBlobUrl);
            } catch (e) {
              console.warn(`[${SCRIPT_NAME}] 撤销旧 blob URL 失败:`, e);
            }
          }
          // ★ 立即从缓存中删除旧记录
          characterSprites.delete(id);

          const data = {
            id,
            characterId: item.characterId,
            expression: item.expression,
            imageBlob: item.imageBlob,
            imageUrl: item.imageUrl || null,
            lastModified: new Date().toISOString(),
          };
          store.put(data);

          // 更新缓存
          let blobUrl;
          if (item.imageUrl) {
            blobUrl = item.imageUrl;
          } else if (item.imageBlob) {
            blobUrl = (topWindow.URL || URL).createObjectURL(item.imageBlob);
          }
          if (blobUrl) {
            characterSprites.set(id, blobUrl);
          }
        });
      });
    });
  }
  // 获取立绘 (带默认表情回退)
  function getSprite(characterId, expression) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!characterId) {
        console.log(`[${SCRIPT_NAME}] getSprite: 角色名为空`);
        return null;
      }
      const id = `${characterId}_${expression}`;
      console.log(`[${SCRIPT_NAME}] getSprite 查询: ${id}`);
      // 先查缓存
      if (characterSprites.has(id)) {
        console.log(`[${SCRIPT_NAME}] getSprite 缓存命中: ${id}`);
        return characterSprites.get(id);
      }
      if (!db) yield initDB();
      // 查询主表情
      const result = yield new Promise(resolve => {
        const transaction = db.transaction([STORE_SPRITES], 'readonly');
        const store = transaction.objectStore(STORE_SPRITES);
        const request = store.get(id);
        request.onsuccess = () => {
          if (request.result) {
            let blobUrl;
            if (request.result.imageUrl) {
              blobUrl = request.result.imageUrl;
            } else if (request.result.imageBlob) {
              // ★ 使用 topWindow.URL
              blobUrl = (topWindow.URL || URL).createObjectURL(request.result.imageBlob);
            }
            if (blobUrl) {
              characterSprites.set(id, blobUrl);
              console.log(`[${SCRIPT_NAME}] getSprite 找到: ${id}`);
              resolve(blobUrl);
              return;
            }
          }
          console.log(`[${SCRIPT_NAME}] getSprite 未找到: ${id}`);
          resolve(null);
        };
        request.onerror = () => {
          console.log(`[${SCRIPT_NAME}] getSprite 查询错误: ${id}`);
          resolve(null);
        };
      });
      if (result) return result;
      // 回退到默认表情 (在新事务中)
      if (expression !== '默认') {
        const fallbackId = `${characterId}_默认`;
        console.log(`[${SCRIPT_NAME}] getSprite 尝试回退: ${fallbackId}`);
        // 先查缓存
        if (characterSprites.has(fallbackId)) {
          console.log(`[${SCRIPT_NAME}] getSprite 回退缓存命中: ${fallbackId}`);
          return characterSprites.get(fallbackId);
        }
        // 新事务查询
        return new Promise(resolve => {
          const transaction = db.transaction([STORE_SPRITES], 'readonly');
          const store = transaction.objectStore(STORE_SPRITES);
          const request = store.get(fallbackId);
          request.onsuccess = () => {
            if (request.result) {
              let blobUrl;
              if (request.result.imageUrl) {
                blobUrl = request.result.imageUrl;
              } else if (request.result.imageBlob) {
                // ★ 使用 topWindow.URL
                blobUrl = (topWindow.URL || URL).createObjectURL(request.result.imageBlob);
              }
              if (blobUrl) {
                characterSprites.set(fallbackId, blobUrl);
                console.log(`[${SCRIPT_NAME}] getSprite 回退找到: ${fallbackId}`);
                resolve(blobUrl);
                return;
              }
            }
            console.log(`[${SCRIPT_NAME}] getSprite 回退也未找到: ${fallbackId}`);
            resolve(null);
          };
          request.onerror = () => resolve(null);
        });
      }
      return null;
    });
  }
  // 获取角色所有立绘
  function getCharacterSprites(characterId) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!db) yield initDB();
      return new Promise(resolve => {
        const transaction = db.transaction([STORE_SPRITES], 'readonly');
        const store = transaction.objectStore(STORE_SPRITES);
        const index = store.index('characterId');
        const request = index.getAll(characterId);
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  }
  // 删除立绘
  function deleteSprite(characterId, expression) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!db) yield initDB();
      const id = `${characterId}_${expression}`;
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_SPRITES], 'readwrite');
        const store = transaction.objectStore(STORE_SPRITES);
        const request = store.delete(id);
        request.onsuccess = () => {
          if (characterSprites.has(id)) {
            // ★ 使用 topWindow.URL
            (topWindow.URL || URL).revokeObjectURL(characterSprites.get(id));
            characterSprites.delete(id);
          }
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }
  // 加载所有立绘到缓存
  function loadAllSpritesToCache() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!db) yield initDB();
      return new Promise(resolve => {
        const transaction = db.transaction([STORE_SPRITES], 'readonly');
        const store = transaction.objectStore(STORE_SPRITES);
        const request = store.getAll();
        request.onsuccess = () => {
          const sprites = request.result || [];
          sprites.forEach(sprite => {
            if (sprite.imageUrl) {
              characterSprites.set(sprite.id, sprite.imageUrl);
            } else if (sprite.imageBlob) {
              // ★ 使用 topWindow.URL
              const blobUrl = (topWindow.URL || URL).createObjectURL(sprite.imageBlob);
              characterSprites.set(sprite.id, blobUrl);
            }
          });
          console.log(`[${SCRIPT_NAME}] 已加载 ${sprites.length} 个立绘到缓存`);
          resolve();
        };
        request.onerror = () => resolve();
      });
    });
  }
  // ============================================
  // 背景图片存储
  // ============================================
  // 保存背景图片
  function saveBackground(sceneName_1, imageBlob_1) {
    return __awaiter(this, arguments, void 0, function* (sceneName, imageBlob, imageUrl = null) {
      if (!db) yield initDB();
      return new Promise((resolve, reject) => {
        const id = sceneName;
        const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
        const store = transaction.objectStore(STORE_BACKGROUNDS);
        const data = {
          id,
          sceneName,
          imageBlob,
          imageUrl,
          lastModified: new Date().toISOString(),
        };
        const request = store.put(data);
        request.onsuccess = () => {
          // ★ 使用 topWindow.URL
          let blobUrl;
          if (imageUrl) {
            blobUrl = imageUrl;
          } else if (imageBlob) {
            blobUrl = (topWindow.URL || URL).createObjectURL(imageBlob);
          }
          if (blobUrl) {
            sceneBackgrounds.set(id, blobUrl);
          }
          console.log(`[${SCRIPT_NAME}] 背景已保存: ${id}`);
          resolve(blobUrl);
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  // 批量保存背景
  function saveBackgroundsBatch(backgroundsList) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!backgroundsList || backgroundsList.length === 0) return;
      if (!db) yield initDB();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
        const store = transaction.objectStore(STORE_BACKGROUNDS);

        transaction.oncomplete = () => {
          console.log(`[${SCRIPT_NAME}] 批量保存背景完成: ${backgroundsList.length} 个`);
          resolve();
        };

        transaction.onerror = event => {
          console.error(`[${SCRIPT_NAME}] 批量保存背景失败:`, event.target.error);
          reject(event.target.error);
        };

        backgroundsList.forEach(item => {
          const id = item.sceneName;
          const data = {
            id,
            sceneName: item.sceneName,
            imageBlob: item.imageBlob,
            imageUrl: item.imageUrl || null,
            lastModified: new Date().toISOString(),
          };
          store.put(data);

          // 更新缓存
          let blobUrl;
          if (item.imageUrl) {
            blobUrl = item.imageUrl;
          } else if (item.imageBlob) {
            blobUrl = (topWindow.URL || URL).createObjectURL(item.imageBlob);
          }
          if (blobUrl) {
            sceneBackgrounds.set(id, blobUrl);
            console.log(
              `[${SCRIPT_NAME}] [DEBUG] saveBackgroundsBatch 更新缓存: "${id}" URL: ${blobUrl.substring(0, 50)}... keys=${sceneBackgrounds.size}`,
            );
          }
        });
      });
    });
  }
  // 获取背景图片
  function getBackground(sceneName) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!sceneName) return null;
      // [DEBUG]
      console.log(
        `[${SCRIPT_NAME}] [DEBUG] getBackground 查缓存: "${sceneName}" (len=${sceneName.length}). CacheSize: ${sceneBackgrounds.size}`,
      );
      // if (sceneBackgrounds.size < 10) console.log(`[${SCRIPT_NAME}] [DEBUG] Cache Keys:`, Array.from(sceneBackgrounds.keys()));

      // 先查缓存
      if (sceneBackgrounds.has(sceneName)) {
        console.log(`[${SCRIPT_NAME}] [DEBUG] getBackground 命中缓存: "${sceneName}"`);
        return sceneBackgrounds.get(sceneName);
      }
      if (!db) yield initDB();
      return new Promise(resolve => {
        const transaction = db.transaction([STORE_BACKGROUNDS], 'readonly');
        const store = transaction.objectStore(STORE_BACKGROUNDS);
        const request = store.get(sceneName);
        request.onsuccess = () => {
          if (request.result) {
            let blobUrl;
            if (request.result.imageUrl) {
              blobUrl = request.result.imageUrl;
            } else if (request.result.imageBlob) {
              // ★ 使用 topWindow.URL 确保 Blob URL 在正确的窗口上下文中创建
              blobUrl = (topWindow.URL || URL).createObjectURL(request.result.imageBlob);
            }
            if (blobUrl) {
              sceneBackgrounds.set(sceneName, blobUrl);
              console.log(`[${SCRIPT_NAME}] [DEBUG] 背景 URL 获取成功: ${sceneName}`);
              resolve(blobUrl);
              return;
            }
          }
          resolve(null);
        };
        request.onerror = () => resolve(null);
      });
    });
  }
  // 删除背景图片
  function deleteBackground(sceneName) {
    return __awaiter(this, void 0, void 0, function* () {
      if (!db) yield initDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_BACKGROUNDS], 'readwrite');
        const store = transaction.objectStore(STORE_BACKGROUNDS);
        const request = store.delete(sceneName);
        request.onsuccess = () => {
          if (sceneBackgrounds.has(sceneName)) {
            // ★ 使用 topWindow.URL
            (topWindow.URL || URL).revokeObjectURL(sceneBackgrounds.get(sceneName));
            sceneBackgrounds.delete(sceneName);
          }
          console.log(`[${SCRIPT_NAME}] 背景已删除: ${sceneName}`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    });
  }
  // 获取所有背景图片
  function getAllBackgrounds() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!db) yield initDB();
      return new Promise(resolve => {
        const transaction = db.transaction([STORE_BACKGROUNDS], 'readonly');
        const store = transaction.objectStore(STORE_BACKGROUNDS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  }
  // 加载所有背景到缓存
  function loadAllBackgroundsToCache() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!db) yield initDB();
      return new Promise(resolve => {
        const transaction = db.transaction([STORE_BACKGROUNDS], 'readonly');
        const store = transaction.objectStore(STORE_BACKGROUNDS);
        const request = store.getAll();
        request.onsuccess = () => {
          const backgrounds = request.result || [];
          backgrounds.forEach(bg => {
            if (bg.imageUrl) {
              sceneBackgrounds.set(bg.id, bg.imageUrl);
            } else if (bg.imageBlob) {
              // ★ 使用 topWindow.URL
              const blobUrl = (topWindow.URL || URL).createObjectURL(bg.imageBlob);
              sceneBackgrounds.set(bg.id, blobUrl);
            }
          });
          console.log(`[${SCRIPT_NAME}] 已加载 ${backgrounds.length} 个背景到缓存`);
          resolve();
        };
        request.onerror = () => resolve();
      });
    });
  }
  // ============================================
  // 立绘管理器 - 多角色、动画、特效
  // ============================================
  const SpriteManager = {
    // 当前显示的角色 { characterId: { slot: 'left'|'center'|'right', element: jQuery, expression: string } }
    activeCharacters: new Map(),
    // 当前说话者
    currentSpeaker: null,
    // 主角名称（从数据库获取）
    protagonistName: null,
    // 角色出场顺序队列（用于4+角色时的替换）
    characterQueue: [],
    // 当前场景
    currentScene: null,
    // 表情到情绪的映射（仅保留动画效果，移除滤镜效果）
    emotionMap: {
      生气: 'angry', // 抖动动画
      惊讶: 'surprised', // 弹跳动画
      // 以下表情不添加特效，避免出戏
      难过: null,
      害羞: null,
      大笑: null,
      嘲讽: null,
      微笑: null,
      搞怪: null,
      思考: null,
      默认: null,
    },
    // 初始化 - 获取主角名称
    init() {
      this.protagonistName = this.getProtagonistName();
      console.log(`[${SCRIPT_NAME}] SpriteManager 初始化, 主角: ${this.protagonistName || '未识别'}`);
    },
    // 从数据库获取主角名称（优先使用SillyTavern用户名）
    getProtagonistName() {
      var _a, _b, _c;
      try {
        // 1. 优先尝试从 SillyTavern 获取用户名
        const stContext =
          (_b = (_a = topWindow.SillyTavern) === null || _a === void 0 ? void 0 : _a.getContext) === null ||
          _b === void 0
            ? void 0
            : _b.call(_a);
        if (stContext === null || stContext === void 0 ? void 0 : stContext.name1) {
          console.log(`[${SCRIPT_NAME}] 主角名称来自SillyTavern: ${stContext.name1}`);
          return stContext.name1;
        }
        // 2. 尝试从数据库表格获取
        const api = topWindow.AutoCardUpdaterAPI;
        if (!api || typeof api.exportTableAsJson !== 'function') {
          console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 不可用，无法从数据库读取主角`);
          return null;
        }
        const tableData = api.exportTableAsJson();
        if (!tableData) return null;
        const protagonistSheets = ['主角信息', '主角', '玩家信息', 'User', 'user', '用户'];
        const nameCols = ['人物名称', '姓名', '名字', '角色名', 'name', 'Name'];
        for (const sheetKey of Object.keys(tableData)) {
          if (!sheetKey.startsWith('sheet_')) continue;
          const sheet = tableData[sheetKey];
          const sheetName = (sheet === null || sheet === void 0 ? void 0 : sheet.name) || '';
          const content = (sheet === null || sheet === void 0 ? void 0 : sheet.content) || [];
          if (!protagonistSheets.includes(sheetName) || content.length < 2) continue;
          const headers = content[0] || [];
          for (const col of nameCols) {
            const idx = headers.indexOf(col);
            if (idx !== -1 && ((_c = content[1]) === null || _c === void 0 ? void 0 : _c[idx])) {
              const name = content[1][idx].trim();
              console.log(`[${SCRIPT_NAME}] 主角名称来自数据库(${sheetName}): ${name}`);
              return name;
            }
          }
        }
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 获取主角名称失败:`, e);
      }
      console.log(`[${SCRIPT_NAME}] 未能识别主角名称`);
      return null;
    },
    // 判断角色是否是主角
    isProtagonist(characterId) {
      return this.protagonistName && characterId === this.protagonistName;
    },
    // 分配角色槽位（只支持2个角色：左侧和右侧）
    assignSlot(characterId) {
      // 主角固定左侧
      if (this.isProtagonist(characterId)) {
        return 'left';
      }
      // 检查现有槽位
      const usedSlots = new Set();
      this.activeCharacters.forEach(info => {
        usedSlots.add(info.slot);
      });
      // 非主角分配右侧
      if (!usedSlots.has('right')) return 'right';
      // 如果没有主角，可以使用左侧
      if (!usedSlots.has('left') && !this.protagonistName) return 'left';
      // 槽位已满，需要替换
      return null;
    },
    // 移除最早出场的非主角角色
    removeOldestNonProtagonist() {
      for (let i = 0; i < this.characterQueue.length; i++) {
        const charId = this.characterQueue[i];
        if (!this.isProtagonist(charId) && this.activeCharacters.has(charId)) {
          const info = this.activeCharacters.get(charId);
          const exitClass = info.slot === 'left' ? 'exiting-left' : 'exiting-right';
          // 播放退场动画
          if (info.element) {
            info.element
              .removeClass('speaking silent entering-left entering-center entering-right')
              .addClass(exitClass);
            // 动画结束后移除元素
            setTimeout(() => {
              info.element.remove();
            }, 400);
          }
          this.activeCharacters.delete(charId);
          this.characterQueue.splice(i, 1);
          return info.slot;
        }
      }
      return 'center'; // 默认返回中间
    },
    // 更新立绘显示
    updateSprite($overlay, characterId, expression) {
      return __awaiter(this, void 0, void 0, function* () {
        if (!characterId) {
          // 旁白 - 暗化所有角色
          this.setSpeaker(null);
          return;
        }
        const spriteUrl = yield getSprite(characterId, expression);
        let slot = null;
        let isNewCharacter = false;
        // 检查角色是否已在场
        if (this.activeCharacters.has(characterId)) {
          // 更新表达式
          const info = this.activeCharacters.get(characterId);
          slot = info.slot;
          // 检查表情是否变化
          if (info.expression !== expression) {
            info.expression = expression;
            // 触发表情切换动画
            yield this.updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, false);
          }
        } else {
          // 新角色入场
          isNewCharacter = true;
          slot = this.assignSlot(characterId);
          if (!slot) {
            // 需要替换旧角色
            slot = this.removeOldestNonProtagonist();
          }
          // 添加到队列和活跃列表
          this.characterQueue.push(characterId);
          this.activeCharacters.set(characterId, {
            slot,
            expression,
            element: null,
          });
          yield this.updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, true);
        }
        // 设置当前说话者
        this.setSpeaker(characterId);
        // 应用情绪特效
        this.applyEmotionEffect(characterId, expression);
      });
    },
    // 更新/创建角色立绘元素
    updateCharacterSprite($overlay, characterId, expression, spriteUrl, slot, isEntering) {
      return __awaiter(this, void 0, void 0, function* () {
        const $charLayer = $overlay.find('.gal-layer-character');
        let $slot = $charLayer.find(`.gal-char-slot.slot-${slot}`);
        // 如果槽位不存在，创建它
        if (!$slot.length) {
          $slot = $(`<div class="gal-char-slot slot-${slot}"></div>`);
          $charLayer.append($slot);
          // 重新排序
          const $slots = $charLayer.find('.gal-char-slot').sort((a, b) => {
            const order = { left: 1, center: 2, right: 3 };
            const aSlot = $(a).hasClass('slot-left') ? 'left' : $(a).hasClass('slot-center') ? 'center' : 'right';
            const bSlot = $(b).hasClass('slot-left') ? 'left' : $(b).hasClass('slot-center') ? 'center' : 'right';
            return order[aSlot] - order[bSlot];
          });
          $charLayer.append($slots);
        }
        const enterClass = isEntering ? `entering-${slot}` : 'expression-change';
        const emotion = this.emotionMap[expression] || '';
        const emotionAttr = emotion ? `data-emotion="${emotion}"` : '';
        let spriteHtml;
        if (spriteUrl) {
          spriteHtml = `
          <div class="gal-char-container ${enterClass}" data-character="${characterId}" data-expression="${expression}" ${emotionAttr}>
            <img class="gal-char-img" src="${spriteUrl}" alt="${characterId}">
          </div>
        `;
        } else {
          spriteHtml = `
          <div class="gal-char-container ${enterClass}" data-character="${characterId}" data-expression="${expression}" ${emotionAttr}>
            <div class="gal-char-placeholder" title="点击上传立绘">
              <i class="fa-solid fa-user-plus"></i>
              <span>添加立绘</span>
            </div>
          </div>
        `;
        }
        $slot.html(spriteHtml);
        // 更新引用
        const info = this.activeCharacters.get(characterId);
        if (info) {
          info.element = $slot.find('.gal-char-container');
        }
        // 移除入场动画类（延迟）
        if (isEntering) {
          setTimeout(() => {
            $slot.find('.gal-char-container').removeClass(enterClass);
          }, 500);
        }
      });
    },
    // 设置当前说话者
    setSpeaker(speakerId) {
      this.currentSpeaker = speakerId;
      this.activeCharacters.forEach((info, charId) => {
        if (info.element) {
          if (speakerId === null) {
            // 旁白时，所有角色都暗化
            info.element.removeClass('speaking').addClass('silent');
          } else if (charId === speakerId) {
            info.element.removeClass('silent').addClass('speaking');
          } else {
            info.element.removeClass('speaking').addClass('silent');
          }
        }
      });
    },
    // 应用情绪特效
    applyEmotionEffect(characterId, expression) {
      const info = this.activeCharacters.get(characterId);
      if (!info || !info.element) return;
      const emotion = this.emotionMap[expression] || '';
      // 移除旧的情绪属性
      info.element.removeAttr('data-emotion');
      // 应用新的情绪
      if (emotion) {
        info.element.attr('data-emotion', emotion);
      }
    },
    // 查找最佳匹配的场景
    findBestMatchScene(sceneName) {
      if (!sceneName) return null;
      if (sceneBackgrounds.has(sceneName)) return sceneName;
      // 模糊匹配策略
      let bestMatch = null;
      let maxLength = 0;
      const scenes = Array.from(sceneBackgrounds.keys());
      // 1. 尝试去除括号后的名称匹配
      const cleanName = sceneName.replace(/\s*[\(（].*?[\)）]/g, '').trim();
      for (const knownScene of scenes) {
        // 去除已知场景的括号
        const cleanKnown = knownScene.replace(/\s*[\(（].*?[\)）]/g, '').trim();
        // 策略A: 只要去除括号后的核心词相同
        if (cleanName && cleanKnown && cleanName === cleanKnown) {
          return knownScene; // 优先返回
        }
        // 策略B: 包含关系
        if (knownScene.includes(sceneName) || sceneName.includes(knownScene)) {
          // 记录最长的匹配（通常更准确）
          const len = Math.min(knownScene.length, sceneName.length);
          if (len > maxLength) {
            maxLength = len;
            bestMatch = knownScene;
          }
        }
      }
      return bestMatch || sceneName;
    },
    // 应用场景色调和背景图片
    applySceneTint($overlay, scene) {
      return __awaiter(this, void 0, void 0, function* () {
        // 尝试自动修正场景名
        const originalScene = scene;
        if (scene) {
          scene = this.findBestMatchScene(scene);
          if (originalScene !== scene) {
            console.log(`[${SCRIPT_NAME}] [自动修正] 场景幻觉修正: "${originalScene}" -> "${scene}"`);
          }
        }
        if (this.currentScene === scene) return;
        this.currentScene = scene;
        const $charLayer = $overlay.find('.gal-layer-character');
        const $bgLayer = $overlay.find('.gal-layer-bg');
        // 移除旧的场景类
        $charLayer.removeClass('scene-night scene-indoor scene-outdoor');
        if (!scene) {
          // 重置为默认背景
          $bgLayer.css({
            'background-image': '',
            'background-size': '',
            'background-position': '',
          });
          return;
        }
        // 尝试获取场景背景图片
        console.log(`[${SCRIPT_NAME}] [DEBUG] applySceneTint 被调用，场景: "${scene}" (len=${scene.length})`);
        // console.log(`[${SCRIPT_NAME}] [DEBUG] 当前Cache Keys:`, Array.from(sceneBackgrounds.keys()));
        const bgUrl = yield getBackground(scene);
        console.log(`[${SCRIPT_NAME}] [DEBUG] getBackground 返回: ${bgUrl ? '有图片URL' : 'null/undefined'}`);
        if (bgUrl) {
          // 应用背景图片
          $bgLayer
            .addClass('has-bg')
            .removeClass('generating-bg')
            .empty()
            .css({
              'background-image': `url(${bgUrl})`,
              'background-size': 'cover',
              'background-position': 'center',
            });
          console.log(`[${SCRIPT_NAME}] 应用背景成功: ${scene}, URL: ${bgUrl.substring(0, 50)}...`);
        } else {
          // 检查是否正在生成
          if (typeof BGMManager !== 'undefined' && BGMManager.generatingScenes.has(scene)) {
            $bgLayer.removeClass('has-bg').addClass('generating-bg').css({
              'background-image': '',
              'background-size': '',
              'background-position': '',
            });
            $bgLayer.html(`
                            <div class="gal-gen-indicator">
                                <div class="gal-gen-rings">
                                    <i class="fa-solid fa-paintbrush gal-gen-icon"></i>
                                </div>
                                <div class="gal-gen-text">
                                    <span class="gal-gen-title">GENERATING</span>
                                    <span class="gal-gen-scene">${scene}</span>
                                    <div class="gal-gen-dots">
                                        <span class="gal-gen-dot"></span>
                                        <span class="gal-gen-dot"></span>
                                        <span class="gal-gen-dot"></span>
                                    </div>
                                </div>
                            </div>
                        `);
          } else {
            // 没有背景图片，使用默认渐变
            $bgLayer.removeClass('has-bg generating-bg').empty().css({
              'background-image': '',
              'background-size': '',
              'background-position': '',
            });
          }
        }
        // 根据场景名称判断色调（用于立绘滤镜）
        const sceneLower = scene.toLowerCase();
        if (sceneLower.includes('夜') || sceneLower.includes('night') || sceneLower.includes('晚')) {
          $charLayer.addClass('scene-night');
        } else if (
          sceneLower.includes('室内') ||
          sceneLower.includes('indoor') ||
          sceneLower.includes('房间') ||
          sceneLower.includes('屋')
        ) {
          $charLayer.addClass('scene-indoor');
        }
      });
    },
    // 清除所有立绘
    clearAll($overlay) {
      this.activeCharacters.clear();
      this.characterQueue = [];
      this.currentSpeaker = null;
      this.currentScene = null;
      if ($overlay) {
        $overlay.find('.gal-layer-character').empty();
      }
    },
    // 重置（切换消息时）
    reset($overlay) {
      this.clearAll($overlay);
    },
  };
  // ============================================
  // 消息解析器
  // ============================================
  function parseGalgameContent(html) {
    // ★ 性能优化：检查缓存
    const cacheKey = html.length + '_' + html.substring(0, 150) + '_' + html.substring(html.length - 50);
    if (parseCache.has(cacheKey)) {
      return parseCache.get(cacheKey);
    }

    // 移除 <think> 和 <thinking> 标签块 (深度思考内容)
    // 1. 先移除闭合的块 - 使用预编译正则
    html = html.replace(RE_THINK_CLOSED, '');
    // 2. 移除未闭合的块 (流式输出时) - 从标签开始直到结尾
    html = html.replace(RE_THINK_UNCLOSED, '');
    const result = {
      segments: [], // { type: 'narration'|'dialogue', speaker: string|null, text: string, expression: string|null }
      currentBackground: null, // { scene }
      bgm: null, // { keyword }
      options: [], // { id, text }
    };
    // 先移除 highlight.js 添加的 <code> 和 <pre> 包裹标签 - 使用预编译正则
    let cleanedHtml = html
      .replace(RE_PRE_TAG, '')
      .replace(RE_PRE_CLOSE, '')
      .replace(RE_CODE_TAG, '')
      .replace(RE_CODE_CLOSE, '');

    // ★ 修复：清理标签之间的空白字符 (如 </p>   <p>)，防止解析错误
    cleanedHtml = cleanedHtml.replace(RE_TAG_WHITESPACE, '><');
    // 提取 <maintext> 内容（如果有）
    // 改进：支持流式输出中尚未闭合的 <maintext>
    let content = cleanedHtml;
    const maintextMatch = cleanedHtml.match(RE_MAINTEXT_CLOSED);
    if (maintextMatch) {
      content = maintextMatch[1];
    } else {
      // 尝试匹配未闭合的 (流式输出)
      const maintextStart = cleanedHtml.match(RE_MAINTEXT_UNCLOSED);
      if (maintextStart) {
        content = maintextStart[1];
      }
    }
    // 解析背景标签 - 使用预编译正则
    const backgroundMatch = content.match(RE_BACKGROUND);
    // console.log(`[${SCRIPT_NAME}] [DEBUG] 背景标签正则匹配结果:`, backgroundMatch);

    // 解析生图标签 <bgimg>TAGS</bgimg> - 使用预编译正则
    // 允许 <bgimg> 在 <background> 内部或外部，只要都在 content 里
    const bgimgMatch = content.match(RE_BGIMG);

    if (backgroundMatch) {
      result.currentBackground = {
        scene: backgroundMatch[1],
      };
      // 如果存在生图标签，标记为需要生成
      if (bgimgMatch && bgimgMatch[1]) {
        result.currentBackground.generationTags = bgimgMatch[1].trim();
        console.log(`[${SCRIPT_NAME}] [DEBUG] 解析到背景生成请求: "${backgroundMatch[1]}" Tags: "${bgimgMatch[1]}"`);
      }
      console.log(`[${SCRIPT_NAME}] [DEBUG] 解析到背景场景: "${backgroundMatch[1]}"`);
    } else {
      // console.log(`[${SCRIPT_NAME}] [DEBUG] 未匹配到背景标签`);
    }
    // 解析 BGM 标签 <bgm>关键词</bgm> - 使用预编译正则
    const bgmMatch = content.match(RE_BGM);
    if (bgmMatch) {
      result.bgm = {
        keyword: bgmMatch[1].replace(' - ', ' ').trim(), // 简单清洗
      };
      console.log(`[${SCRIPT_NAME}] [DEBUG] 解析到 BGM: "${result.bgm.keyword}"`);
    }
    // 解析所有 <option> 标签
    const optionRegex = /<option\s+id="([^"]+)"[^>]*>([^<]+)<\/option>/gi;
    let optionMatch;
    while ((optionMatch = optionRegex.exec(content)) !== null) {
      result.options.push({
        id: optionMatch[1],
        text: optionMatch[2].trim(),
      });
    }
    // 动态获取表情列表（预设 + 自定义）
    const expressionNames = getAllExpressions();
    const expressionPattern = expressionNames.map(e => e.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    /**
     * 解析 TTS 配置字符串
     * @param {string} ttsString - tts="speaker=xxx;emotion=xxx;context=xxx"
     * @param {string} defaultSpeaker - 默认说话人（从对话解析获取）
     * @returns {object} TTS配置对象
     */
    function parseTTSConfig(ttsString, defaultSpeaker) {
      if (!ttsString) return null;

      const config = {
        speaker: defaultSpeaker, // 默认使用对话中的角色名
        emotion: null,
        context: null,
      };

      // 解析 key=value 对
      const pairs = ttsString.split(';');
      for (const pair of pairs) {
        const [key, value] = pair.trim().split('=');
        if (key && value) {
          const trimmedKey = key.trim();
          const trimmedValue = value.trim();

          if (trimmedKey === 'speaker') config.speaker = trimmedValue;
          else if (trimmedKey === 'emotion') config.emotion = trimmedValue;
          else if (trimmedKey === 'context') config.context = trimmedValue;
        }
      }

      return config;
    }

    // Helper: 解析单个文本段落
    function parseSegmentText(text, ttsConfigString = null) {
      if (!text) return null;
      text = text.trim();
      if (!text) return null;
      // 移除 highlight.js 添加的 <span> 标签但保留内容
      text = text.replace(/<span[^>]*>/gi, '').replace(/<\/span>/gi, '');
      // 移除 <q> 标签但保留其内容
      text = text.replace(/<q>([^<]*)<\/q>/gi, '$1');
      text = text.replace(/<q[^>]*>([^<]*)<\/q>/gi, '$1');
      text = text.replace(/<q[^>]*>([\s\S]*?)<\/q>/gi, '$1');
      // 提取表情标签（格式: <表情名>）
      let expression = null;
      const expressionTagRegex = new RegExp(`<(${expressionPattern})>`, 'i');
      const exprMatch = text.match(expressionTagRegex);
      if (exprMatch) {
        expression = exprMatch[1];
        // 移除表情标签
        text = text.replace(expressionTagRegex, '').trim();
      }
      // 检查是否是对话
      // 格式1: 角色名: "对话内容" (带引号)
      // 格式2: 角色名: 对话内容 (不带引号，冒号后直接是内容)
      // 支持中英文冒号和各种引号
      let dialogueMatch = text.match(/^([^:：]{1,20})[：:]\s*["\"「『](.+)["\"\"」』]$/);
      // 如果没匹配到带引号的，尝试不带引号的格式
      if (!dialogueMatch) {
        dialogueMatch = text.match(/^([^:：]{1,20})[：:]\s*(.+)$/);
      }
      if (dialogueMatch && dialogueMatch[1] && dialogueMatch[2]) {
        const speaker = dialogueMatch[1].trim();
        const dialogue = dialogueMatch[2].trim();
        // 说话者名字不应该太长（超过20字符可能是解析错误）
        if (speaker.length <= 20 && speaker.length > 0) {
          const result = {
            type: 'dialogue',
            speaker: speaker,
            text: dialogue,
            expression: expression || '默认', // 对话默认使用"默认"表情
          };
          // ★ 新增：如果是对话且有TTS配置，添加到结果中
          if (ttsConfigString) {
            result.tts = parseTTSConfig(ttsConfigString, speaker);
          }
          return result;
        }
      }
      // 默认为旁白（旁白不支持TTS）
      return {
        type: 'narration',
        speaker: null,
        text: text,
        expression: null,
      };
    }
    // 解析所有已闭合的 <p> 标签（支持 tts 属性）
    const pTagRegex = /<p(?:\s+tts="([^"]*)")?\s*>([\s\S]*?)<\/p>/gi;
    let match;
    let lastIndex = 0;
    while ((match = pTagRegex.exec(content)) !== null) {
      lastIndex = pTagRegex.lastIndex;
      const ttsConfig = match[1]; // 捕获 tts 属性值
      const seg = parseSegmentText(match[2], ttsConfig);
      if (seg) result.segments.push(seg);
    }
    // ★ 关键修复：尝试匹配末尾未闭合的 <p> 标签 (支持流式输出，也支持 tts 属性)
    const remainingText = content.substring(lastIndex);
    const unclosedPMatch = remainingText.match(/<p(?:\s+tts="([^"]*)")?\s*>([\s\S]*)$/i);
    if (unclosedPMatch) {
      const rawContent = unclosedPMatch[2];
      const ttsConfig = unclosedPMatch[1];
      // 只有当有实质内容时才添加
      if (rawContent && rawContent.trim()) {
        const seg = parseSegmentText(rawContent, ttsConfig);
        if (seg) {
          result.segments.push(seg);
        }
      }
    }
    // 如果没有 <p> 标签，尝试直接解析纯文本
    if (result.segments.length === 0) {
      const plainText = content.replace(/<[^>]+>/g, '').trim();
      if (plainText) {
        result.segments.push({
          type: 'narration',
          speaker: null,
          text: plainText,
          expression: null,
        });
      }
    }
    // ★ 新增逻辑：如果段落过长，进行切分
    const MAX_SEG_LENGTH = 120;
    const finalSegments = [];
    result.segments.forEach(seg => {
      if (!seg.text || seg.text.length <= MAX_SEG_LENGTH) {
        finalSegments.push(seg);
        return;
      }
      // 切分长文本
      let text = seg.text;
      while (text.length > MAX_SEG_LENGTH) {
        // 寻找最佳切分点 (优先标点符号)
        let splitIdx = -1;
        const punctuations = ['。', '！', '？', '…', '\n', '.', '!', '?'];
        // 从 MAX_SEG_LENGTH 往前找标点
        for (let i = MAX_SEG_LENGTH; i >= Math.floor(MAX_SEG_LENGTH * 0.6); i--) {
          if (punctuations.includes(text[i])) {
            splitIdx = i + 1; // 包含标点
            break;
          }
        }
        // 如果没找到标点，尝试找空格
        if (splitIdx === -1) {
          splitIdx = text.lastIndexOf(' ', MAX_SEG_LENGTH);
          if (splitIdx !== -1) splitIdx += 1;
        }
        // 实在找不到，强制切分
        if (splitIdx === -1 || splitIdx < Math.floor(MAX_SEG_LENGTH * 0.6)) {
          splitIdx = MAX_SEG_LENGTH;
        }
        finalSegments.push(Object.assign(Object.assign({}, seg), { text: text.substring(0, splitIdx).trim() }));
        text = text.substring(splitIdx).trim();
      }
      if (text) {
        finalSegments.push(Object.assign(Object.assign({}, seg), { text: text }));
      }
    });
    result.segments = finalSegments;

    // ★ 性能优化：存储解析结果到缓存
    if (parseCache.size >= PARSE_CACHE_MAX_SIZE) {
      // 删除最旧的缓存条目
      const firstKey = parseCache.keys().next().value;
      parseCache.delete(firstKey);
    }
    parseCache.set(cacheKey, result);

    return result;
  }
  // ============================================
  // 样式注入
  // ============================================
  const STYLES_INJECTED_FLAG = `${SCRIPT_ID}_styles_injected`;
  function injectStyles() {
    const targetDoc = topWindow.document;
    // 强制移除旧样式，确保热重载生效
    const oldStyle = targetDoc.getElementById(`${SCRIPT_ID}-styles`);
    if (oldStyle) {
      oldStyle.remove();
    }
    // 移除标记检查，始终重新注入
    topWindow[STYLES_INJECTED_FLAG] = true;
    // 注入字体
    if (!targetDoc.querySelector('link[href*="Noto+Sans+SC"]')) {
      const fontLink = targetDoc.createElement('link');
      fontLink.href =
        'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700;900&family=Barlow:ital,wght@0,400;0,800;1,600&display=swap';
      fontLink.rel = 'stylesheet';
      (targetDoc.head || targetDoc.documentElement).appendChild(fontLink);
    }
    const css = `
      /* ═══════════════════════════════════════════════════════════════
         Galgame 界面插件 - Cyber Pop 全屏沉浸式主题
         ═══════════════════════════════════════════════════════════════ */

      /* 全局Galgame界面层 - 默认内联模式（在#chat内） */
      #gal-global-overlay {
        position: relative !important;
        width: 100% !important;
        min-height: 500px;
        height: 70vh;
        max-height: 800px;
        display: none;
        background: #f0f2f5 !important;
        font-family: ${THEME.fontMain};
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        margin: 10px 0;
      }

      #gal-global-overlay.active {
        display: block !important;
      }

      /* 拖拽手柄样式 */
      .gal-draggable-handle {
        cursor: move;
        user-select: none;
      }

      /* 全屏模式 - 使用!important确保覆盖 */
      #gal-global-overlay.fullscreen {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-height: none !important;
        min-height: 100vh !important;
        z-index: 99999 !important;
        border-radius: 0 !important;
        margin: 0 !important;
        box-shadow: none !important;
      }

      /* 隐藏非Galgame消息楼层 */
      #chat > .mes.gal-hidden {
        display: none !important;
      }

      /* 全屏切换按钮 */
      .gal-fullscreen-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        z-index: 100;
        background: rgba(43, 46, 56, 0.9);
        color: ${THEME.accent};
        border: 2px solid ${THEME.accent};
        padding: 10px 18px;
        font-size: 0.9rem;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
        font-family: ${THEME.fontEng};
        border-radius: 4px;
      }

      .gal-fullscreen-btn:hover {
        background: ${THEME.accent};
        color: ${THEME.dark};
      }

      .gal-fullscreen-btn i {
        font-size: 1rem;
      }

      /* 地点时间状态栏容器 */
      .gal-status-bar-container {
        position: absolute;
        top: 15px;
        right: 120px; /* 在全屏按钮左侧 */
        z-index: 100;
        display: flex;
        gap: 10px;
        align-items: center;
      }

      /* 地点状态栏 */
      .gal-location-bar {
        background: rgba(43, 46, 56, 0.9);
        color: #fff;
        padding: 0 15px;
        height: 30px;
        line-height: 30px;
        font-size: 0.85rem;
        font-weight: 500;
        border-radius: 4px;
        border: 1px solid rgba(0, 210, 255, 0.5);
        white-space: nowrap;
        max-width: 350px;
        overflow: hidden; /* 父容器裁剪，防止溢出 */
        display: flex;
        align-items: center;
      }

      .gal-location-bar i {
        color: ${THEME.accent};
        margin-right: 8px;
        font-size: 0.9rem;
        flex-shrink: 0; /* 图标不许缩小 */
      }

      .gal-location-text {
        /* 移除省略号，以便脚本计算真实宽度 */
        white-space: nowrap;
        transform-origin: left center;
        display: inline-block;
      }

      /* 时间状态栏 */
      .gal-time-bar {
        background: rgba(43, 46, 56, 0.9);
        color: #fff;
        padding: 0 15px;
        height: 30px;
        line-height: 30px;
        font-size: 0.85rem;
        font-weight: 500;
        border-radius: 4px;
        border: 1px solid rgba(255, 0, 85, 0.5);
        white-space: nowrap;
        max-width: 260px; /* 增加一点宽度限制 */
        overflow: hidden;
        display: flex;
        align-items: center;
        /* justify-content: center;  移除居中，改为左对齐配合 padding/margin，方便缩放计算 */
      }

      .gal-time-bar i {
        color: ${THEME.accentSub};
        margin-right: 8px;
        font-size: 0.9rem;
        flex-shrink: 0;
      }

      .gal-time-text {
        white-space: nowrap;
        transform-origin: left center;
        display: inline-block;
      }

      /* 文字自动缩小效果 */
      .gal-status-bar-container .auto-shrink {
        display: inline-block;
        transform-origin: left center;
      }

      /* 全屏模式下调整位置 */
      #gal-global-overlay.fullscreen .gal-status-bar-container {
        right: 130px;
      }

      /* BGM 悬浮小组件 */
      .gal-bgm-widget {
        position: absolute;
        top: 15px;
        left: 15px;
        z-index: 100;
        background: rgba(43, 46, 56, 0.85);
        backdrop-filter: blur(5px);
        padding: 8px 15px;
        border-radius: 20px;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.85rem;
        box-shadow: 0 4px 10px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        border: 1px solid rgba(255,255,255,0.1);
        max-width: 40px; /* 默认收起 */
        overflow: hidden;
        white-space: nowrap;
        cursor: pointer;
      }

      .gal-bgm-widget:hover, .gal-bgm-widget.active {
          max-width: 300px;
          background: rgba(43, 46, 56, 0.95);
      }

      .gal-bgm-icon {
          color: ${THEME.accent};
          animation: galSpin 4s linear infinite;
          animation-play-state: paused;
          font-size: 1.1rem;
          min-width: 20px;
          text-align: center;
      }

      .gal-bgm-widget.playing .gal-bgm-icon {
          animation-play-state: running;
      }

      @keyframes galSpin { 100% { transform: rotate(360deg); } }

      .gal-bgm-info {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          overflow: hidden;
          margin-right: 5px;
      }

      .gal-bgm-title {
          font-weight: bold;
          font-size: 0.8rem;
          color: ${THEME.accent};
      }

      .gal-bgm-ctrl {
          display: flex;
          align-items: center;
          gap: 8px;
      }

      .gal-bgm-btn {
          background: none;
          border: none;
          color: #fff;
          cursor: pointer;
          font-size: 0.9rem;
          padding: 0;
          width: 20px;
      }
      .gal-bgm-btn:hover { color: ${THEME.accent}; }

      .gal-bgm-slider {
          width: 60px;
          height: 4px;
          -webkit-appearance: none;
          background: rgba(255,255,255,0.3);
          border-radius: 2px;
          outline: none;
      }
      .gal-bgm-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 10px; height: 10px;
          background: #fff;
          border-radius: 50%;
          cursor: pointer;
      }

      /* 主容器 - 全屏沉浸式 */
      .gal-game-container {
        position: relative;
        width: 100%;
        height: 100%;
        background: #f0f2f5;
        font-family: ${THEME.fontMain};
        overflow: hidden;
      }

      /* 背景层 */
      .gal-layer-bg {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        z-index: 0;
        background: linear-gradient(135deg, #e8eef5 0%, #f5f5f5 100%);
        overflow: hidden;
      }

      .gal-layer-bg::before {
        content: '';
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background-image: radial-gradient(#ccc 1px, transparent 1px);
        background-size: 20px 20px;
        opacity: 0.3;
        pointer-events: none;
      }

      /* 有背景图片时隐藏默认点阵图案 */
      .gal-layer-bg.has-bg::before {
        display: none;
      }

      /* ═══════════════════════════════════════════════════════════════
         背景生成中特效 - 高性能纯CSS动画
         ═══════════════════════════════════════════════════════════════ */
      .gal-layer-bg.generating-bg {
        background: linear-gradient(-45deg, #1a1a2e, #16213e, #0f3460, #1a1a2e);
        background-size: 400% 400%;
        animation: galGenGradient 3s ease infinite;
      }

      /* 流动渐变背景动画 */
      @keyframes galGenGradient {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }

      /* 扫描线效果 */
      .gal-layer-bg.generating-bg::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 2px,
          rgba(0, 210, 255, 0.03) 2px,
          rgba(0, 210, 255, 0.03) 4px
        );
        animation: galGenScanline 8s linear infinite;
        pointer-events: none;
      }

      @keyframes galGenScanline {
        0% { transform: translateY(-100%); }
        100% { transform: translateY(100%); }
      }

      /* 生成指示器容器 */
      .gal-gen-indicator {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        z-index: 20;
        padding: 40px 60px;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(10px);
        border-radius: 20px;
        border: 1px solid rgba(0, 210, 255, 0.3);
        box-shadow:
          0 0 40px rgba(0, 210, 255, 0.2),
          inset 0 0 40px rgba(0, 210, 255, 0.05);
        animation: galGenPulse 2s ease-in-out infinite;
      }

      @keyframes galGenPulse {
        0%, 100% {
          box-shadow:
            0 0 40px rgba(0, 210, 255, 0.2),
            0 0 80px rgba(0, 210, 255, 0.1),
            inset 0 0 40px rgba(0, 210, 255, 0.05);
        }
        50% {
          box-shadow:
            0 0 60px rgba(0, 210, 255, 0.4),
            0 0 120px rgba(0, 210, 255, 0.2),
            inset 0 0 60px rgba(0, 210, 255, 0.1);
        }
      }

      /* 环形加载动画 - 多层 */
      .gal-gen-rings {
        position: relative;
        width: 80px;
        height: 80px;
      }

      .gal-gen-rings::before,
      .gal-gen-rings::after {
        content: '';
        position: absolute;
        border-radius: 50%;
        border: 3px solid transparent;
      }

      .gal-gen-rings::before {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        border-top-color: #00d2ff;
        border-right-color: rgba(0, 210, 255, 0.3);
        animation: galGenSpin 1.5s linear infinite;
      }

      .gal-gen-rings::after {
        top: 10px;
        left: 10px;
        right: 10px;
        bottom: 10px;
        border-bottom-color: #ff0055;
        border-left-color: rgba(255, 0, 85, 0.3);
        animation: galGenSpin 1s linear infinite reverse;
      }

      @keyframes galGenSpin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      /* 中心图标 */
      .gal-gen-icon {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 1.5rem;
        color: #00d2ff;
        animation: galGenIconPulse 1.5s ease-in-out infinite;
      }

      @keyframes galGenIconPulse {
        0%, 100% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        50% { opacity: 0.7; transform: translate(-50%, -50%) scale(0.9); }
      }

      /* 文字区域 */
      .gal-gen-text {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .gal-gen-title {
        font-size: 1.3rem;
        font-weight: 700;
        color: #fff;
        text-shadow: 0 0 20px rgba(0, 210, 255, 0.8);
        letter-spacing: 2px;
        font-family: ${THEME.fontEng};
      }

      .gal-gen-scene {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.8);
        max-width: 200px;
        text-align: center;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* 进度点 */
      .gal-gen-dots {
        display: flex;
        gap: 6px;
        margin-top: 5px;
      }

      .gal-gen-dot {
        width: 6px;
        height: 6px;
        background: #00d2ff;
        border-radius: 50%;
        animation: galGenDot 1.4s ease-in-out infinite;
      }

      .gal-gen-dot:nth-child(2) { animation-delay: 0.2s; }
      .gal-gen-dot:nth-child(3) { animation-delay: 0.4s; }

      @keyframes galGenDot {
        0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
        40% { transform: scale(1); opacity: 1; box-shadow: 0 0 10px #00d2ff; }
      }

      /* ═══════════════════════════════════════════════════════════════
         立绘动画关键帧
         ═══════════════════════════════════════════════════════════════ */
      @keyframes galSpriteSlideInLeft {
        from { transform: translateX(-100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes galSpriteSlideInRight {
        from { transform: translateX(100px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes galSpriteSlideInCenter {
        from { transform: translateY(50px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      @keyframes galSpriteSlideOutLeft {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(-100px); opacity: 0; }
      }
      @keyframes galSpriteSlideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100px); opacity: 0; }
      }
      @keyframes galSpriteBreathing {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
      }
      @keyframes galSpriteShake {
        0%, 100% { transform: translateX(0); }
        20% { transform: translateX(-5px); }
        40% { transform: translateX(5px); }
        60% { transform: translateX(-3px); }
        80% { transform: translateX(3px); }
      }
      @keyframes galSpriteBounce {
        0% { transform: scale(1); }
        30% { transform: scale(1.15); }
        50% { transform: scale(0.95); }
        70% { transform: scale(1.05); }
        100% { transform: scale(1); }
      }
      @keyframes galSpriteExpressionChange {
        0% { opacity: 0.7; transform: scale(0.98); }
        100% { opacity: 1; transform: scale(1); }
      }

      /* 立绘层 - 多角色布局 (左/中/右) */
      .gal-layer-character {
        position: absolute;
        bottom: 35%;
        left: 0;
        width: 100%;
        height: 55%;
        z-index: 5;
        display: flex;
        justify-content: center;
        align-items: flex-end;
        pointer-events: none;
        padding: 0 3%;
        gap: 2%;
      }

      /* 多角色槽位 */
      .gal-char-slot {
        position: relative;
        flex: 0 0 30%;
        max-width: 30%;
        height: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        pointer-events: auto;
      }
      .gal-char-slot.slot-left { order: 1; }
      .gal-char-slot.slot-right { order: 2; }

      .gal-char-container {
        position: relative;
        max-height: 100%;
        /* --base-scale removed to allow inheritance */
        --state-scale: 1;
        /* scale moved to .gal-char-img to avoid conflict with transform animations on container */
        transform-origin: bottom center;
        max-width: 100%;
        display: flex;
        align-items: flex-end;
        justify-content: center;
        filter: drop-shadow(0 10px 30px rgba(0,0,0,0.4));
        transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275),
                    filter 0.3s ease,
                    opacity 0.3s ease;
        pointer-events: auto;
        cursor: pointer;
        animation: galSpriteBreathing 4s ease-in-out infinite;
      }

      /* 入场动画 */
      .gal-char-container.entering-left { animation: galSpriteSlideInLeft 0.5s ease-out, galSpriteBreathing 4s ease-in-out 0.5s infinite; }
      .gal-char-container.entering-center { animation: galSpriteSlideInCenter 0.5s ease-out, galSpriteBreathing 4s ease-in-out 0.5s infinite; }
      .gal-char-container.entering-right { animation: galSpriteSlideInRight 0.5s ease-out, galSpriteBreathing 4s ease-in-out 0.5s infinite; }

      /* 退场动画 */
      .gal-char-container.exiting-left { animation: galSpriteSlideOutLeft 0.4s ease-in forwards; pointer-events: none; }
      .gal-char-container.exiting-right { animation: galSpriteSlideOutRight 0.4s ease-in forwards; pointer-events: none; }

      /* 表情切换动画 */
      .gal-char-container.expression-change { animation: galSpriteExpressionChange 0.3s ease-out; }

      /* 说话者状态 - 基础样式 */
      .gal-char-container.speaking {
        --state-scale: 1.05;
        z-index: 10;
        filter: drop-shadow(0 15px 40px rgba(0,0,0,0.5));
        position: relative;
      }

      .gal-char-container.silent {
        --state-scale: 0.95;
        filter: drop-shadow(0 5px 15px rgba(0,0,0,0.3));
        z-index: 4;
      }

      /* 说话者光晕效果 - 仅在启用时生效 */
      @keyframes speakingGlow {
        0%, 100% {
          filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.7))
                  drop-shadow(0 0 15px rgba(255, 180, 0, 0.5))
                  drop-shadow(0 15px 30px rgba(0,0,0,0.4));
        }
        50% {
          filter: drop-shadow(0 0 15px rgba(255, 215, 0, 0.9))
                  drop-shadow(0 0 30px rgba(255, 180, 0, 0.7))
                  drop-shadow(0 15px 30px rgba(0,0,0,0.4));
        }
      }

      .gal-layer-character.glow-enabled .gal-char-container.speaking {
        animation: speakingGlow 2s ease-in-out infinite, galSpriteBreathing 4s ease-in-out infinite;
      }

      /* 漫画式对话气泡指示器 - 仅在启用时生效 */
      @keyframes bubbleBounce {
        0%, 100% { transform: translateY(0) scale(1); }
        50% { transform: translateY(-8px) scale(1.1); }
      }

      .gal-layer-character.bubble-enabled .gal-char-container.speaking::before {
        content: '💬';
        position: absolute;
        top: -10px;
        right: 10%;
        font-size: 2.5rem;
        z-index: 100;
        animation: bubbleBounce 1s ease-in-out infinite;
        filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.5));
      }

      /* 情绪特效 - 仅保留动画，移除滤镜 */
      .gal-char-container[data-emotion="angry"] {
        animation: galSpriteShake 0.4s ease-in-out 2, galSpriteBreathing 4s ease-in-out 0.8s infinite;
      }
      .gal-char-container[data-emotion="surprised"] {
        animation: galSpriteBounce 0.5s ease-out, galSpriteBreathing 4s ease-in-out 0.5s infinite;
      }


      /* 场景色调 */
      .gal-layer-character.scene-night {
        filter: hue-rotate(-10deg) brightness(0.85) saturate(0.9);
      }
      .gal-layer-character.scene-night .gal-char-container {
        filter: drop-shadow(0 10px 30px rgba(0,0,100,0.5));
      }
      .gal-layer-character.scene-indoor {
        filter: sepia(0.08) brightness(1.02);
      }
      .gal-layer-character.scene-indoor .gal-char-container {
        filter: drop-shadow(0 10px 30px rgba(100,50,0,0.3));
      }

      .gal-char-img {
        max-height: 100%;
        max-width: 100%;
        height: auto;
        width: auto;
        object-fit: contain;
        object-position: bottom center;
        /* Apply scale here to avoid conflict with container animations */
        transform: scale(calc(var(--base-scale, 1) * var(--state-scale)));
        transform-origin: bottom center;
        transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }

      .gal-char-placeholder {
        width: 200px;
        height: 350px;
        background: linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(240,240,240,0.9) 100%);
        border: 4px dashed #ccc;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #999;
        gap: 10px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        pointer-events: auto;
      }

      .gal-char-placeholder:hover {
        border-color: ${THEME.accent};
        color: ${THEME.accent};
      }

      .gal-char-placeholder i {
        font-size: 4rem;
      }

      .gal-char-placeholder span {
        font-size: 0.9rem;
        font-weight: 600;
      }

      /* 对话框层 - 底部悬浮 */
      .gal-dialog-layer {
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        width: 92%;
        max-width: 1000px;
        z-index: 30;
        pointer-events: auto;
      }

      /* 名字标签 */
      .gal-name-badge {
        position: absolute;
        top: -22px;
        left: 0;
        background: ${THEME.dark};
        color: ${THEME.accent};
        padding: 8px 35px 8px 25px;
        font-size: 1.4rem;
        font-weight: 900;
        font-family: ${THEME.fontEng};
        transform: skewX(-15deg);
        z-index: 35;
        box-shadow: 5px 5px 0 rgba(0,0,0,0.2);
      }

      .gal-name-badge span {
        display: block;
        transform: skewX(15deg);
      }

      .gal-narrator-label {
        background: #666;
        color: #fff;
      }

      /* 生成中状态指示器 */
      .gal-generating-status {
        position: absolute;
        top: -60px;
        left: 50%;
        transform: translateX(-50%) scale(0.8);
        background: linear-gradient(135deg, ${THEME.accent} 0%, #ff6b9d 100%);
        color: #fff;
        padding: 8px 20px;
        font-size: 0.9rem;
        font-weight: 700;
        border-radius: 20px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        opacity: 0;
        transition: all 0.3s ease;
        pointer-events: none;
        z-index: 50;
      }

      .gal-generating-status.show {
        opacity: 1;
        transform: translateX(-50%) scale(1);
      }

      /* 交互栏 - 对话框上方右侧 */
      .gal-interaction-bar {
        position: absolute;
        top: -55px;
        right: 0;
        display: flex;
        gap: 15px;
        z-index: 35;
      }

      .gal-action-btn {
        padding: 12px 30px;
        font-weight: 700;
        font-size: 1.1rem;
        cursor: pointer;
        transform: skewX(-15deg);
        display: flex;
        align-items: center;
        gap: 10px;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 2px solid transparent;
        box-shadow: 5px 5px 0 rgba(0,0,0,0.2);
        font-family: ${THEME.fontMain};
        /* 修复默认样式 - 确保按钮可见 */
        background: ${THEME.white};
        color: ${THEME.dark};
        border-color: ${THEME.dark};
      }

      .gal-action-btn span, .gal-action-btn i {
        transform: skewX(15deg);
      }

      /* 基础悬停效果 */
      .gal-action-btn:hover {
        background: ${THEME.dark};
        color: ${THEME.white};
        transform: skewX(-15deg) translateY(-3px);
        box-shadow: 5px 8px 0 rgba(0,0,0,0.3);
      }

      .gal-action-btn.btn-reroll {
        background: ${THEME.white};
        color: ${THEME.dark};
        border-color: ${THEME.dark};
      }

      .gal-action-btn.btn-reroll:hover {
        background: ${THEME.dark};
        color: ${THEME.accent};
        transform: skewX(-15deg) translateY(-3px);
        box-shadow: 5px 8px 0 ${THEME.accent};
      }

      .gal-action-btn.btn-free {
        background: ${THEME.accentSub};
        color: #fff;
        border-color: ${THEME.accentSub};
      }

      .gal-action-btn.btn-free:hover {
        background: ${THEME.dark};
        color: ${THEME.accentSub};
        border-color: ${THEME.dark};
        transform: skewX(-15deg) translateY(-3px);
        box-shadow: 5px 8px 0 ${THEME.accentSub};
      }

      /* 文本主面板 */
      .gal-text-panel {
        background: rgba(255, 255, 255, 0.95);
        width: 100%;
        height: 250px; /* 固定高度 */
        overflow-y: hidden; /* 内容过多时滚动 */
        padding: 40px 60px 70px 60px;
        border-radius: 0 40px 0 0;
        box-shadow: 0 10px 30px rgba(0,0,0,0.15);
        position: relative;
        border-bottom: 6px solid ${THEME.accent};
        background-image: linear-gradient(135deg, transparent 0%, transparent 95%, rgba(0, 210, 255, 0.1) 95%, rgba(0, 210, 255, 0.1) 100%);
        background-size: 20px 20px;
      }

      .gal-dialog-text {
        font-size: 1.25rem;
        line-height: 1.9;
        color: #333;
        font-weight: 500;
        letter-spacing: 0.02em;
      }

      /* TTS 加载指示器 */
      .gal-tts-loading {
        position: absolute;
        top: 10px;
        right: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: rgba(0, 210, 255, 0.15);
        border: 2px solid ${THEME.accent};
        border-radius: 20px;
        color: ${THEME.accent};
        font-size: 0.85rem;
        font-weight: 600;
        opacity: 0;
        transform: translateY(-10px);
        transition: all 0.3s ease;
        pointer-events: none;
        z-index: 10;
      }

      .gal-tts-loading.active {
        opacity: 1;
        transform: translateY(0);
      }

      .gal-tts-loading i {
        font-size: 1rem;
        color: ${THEME.accent};
      }

      /* 底部工具栏 - 两端对齐，紧凑布局 */
      .gal-bottom-toolbar {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        padding: 0 30px; /* 恢复适中的内边距 */
        box-sizing: border-box;
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        pointer-events: none;
        z-index: 100;
      }

      .gal-bottom-toolbar > * {
        pointer-events: auto;
      }

      /* 左侧按钮组容器 */
      .gal-toolbar-left, .gal-toolbar-right {
        display: flex;
        align-items: flex-end;
        gap: 8px; /* 减小间距 */
      }

      /* 普通按钮 - 缩小尺寸 */
      .gal-footer-btn {
        background: rgba(255, 255, 255, 0.9) !important;
        color: ${THEME.dark} !important;
        padding: 0 12px !important; /* 减小内边距 */
        font-family: ${THEME.fontEng} !important;
        font-weight: 800 !important;
        font-size: 0.85rem !important; /* 减小字号 */
        cursor: pointer !important;
        transition: all 0.2s !important;
        border: 2px solid ${THEME.dark} !important;
        display: flex !important;
        align-items: center !important;
        gap: 6px !important;
        height: 36px !important; /* 减小高度 */
        transform: skewX(-10deg) !important;
        box-shadow: 2px 2px 0 rgba(0,0,0,0.1) !important;
        border-radius: 0 !important;
      }

      .gal-footer-btn i, .gal-footer-btn span {
        transform: skewX(10deg) !important;
      }

      .gal-footer-btn:hover {
        background: ${THEME.dark} !important;
        color: #fff !important;
        transform: skewX(-10deg) translateY(-2px) !important;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.2) !important;
      }

      /* NEXT 按钮 - 保持醒目但在此基础上微调 */
      .gal-footer-btn-next {
        background: ${THEME.dark} !important;
        color: #fff !important;
        font-size: 1.3rem !important; /* 稍微减小字号 */
        font-weight: 800 !important;
        padding: 0 40px !important;
        height: 55px !important; /* 稍微减小高度以适配 */
        min-width: 140px !important;
        border-radius: 0 !important;
        border: 2px solid ${THEME.dark} !important;
        margin-left: 15px !important;
        margin-right: 0 !important; /* 移除额外的右边距 */
        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: center !important;
        gap: 10px !important;
        white-space: nowrap !important;
        line-height: 1 !important;
        box-shadow: 4px 4px 0 rgba(0,0,0,0.2) !important;
        flex-shrink: 0 !important;
        clip-path: polygon(25px 0, 100% 0, 100% 100%, 0% 100%) !important;
        transition: all 0.2s ease !important;
        transform: none !important;
      }

      .gal-footer-btn-next:hover {
        background: ${THEME.accent} !important;
        color: ${THEME.dark} !important;
        padding-right: 50px !important;
        transform: translateY(-2px) !important;
      }

      .gal-footer-btn-next i {
        font-size: 1.1rem !important;
        margin: 0 !important;
      }

      /* 进度指示器 */
      .gal-progress-indicator {
        font-family: ${THEME.fontEng};
        font-size: 0.85rem;
        font-weight: 700;
        color: #888;
        padding: 6px 10px;
        display: flex;
        align-items: center;
        height: 36px;
      }

      /* 导航按钮 (PREV, AUTO, SKIP) - 统一样式 */
      .gal-nav-btn {
        /* 使用与 .gal-footer-btn 相同的样式 */
      }

      .gal-nav-btn.active {
        background: ${THEME.accent} !important;
        color: ${THEME.dark} !important;
        box-shadow: inset 1px 1px 3px rgba(0,0,0,0.2) !important;
      }

      /* AUTO 播放中状态 */
      .gal-auto-playing {
        background: ${THEME.accentSub} !important;
        color: #fff !important;
        border-color: ${THEME.accentSub} !important;
        animation: galPulse 1s infinite;
      }

      @keyframes galPulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }

      /* 自由输入弹窗 */
      .gal-input-modal {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        backdrop-filter: blur(4px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: galFadeIn 0.2s ease;
      }

      @keyframes galFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .gal-input-box {
        background: ${THEME.white};
        border: 3px solid ${THEME.dark};
        box-shadow: 10px 10px 0 rgba(0,0,0,0.15);
        width: 90%;
        max-width: 500px;
        padding: 25px;
      }

      .gal-input-title {
        font-family: ${THEME.fontEng};
        font-size: 1.3rem;
        font-weight: 800;
        color: ${THEME.dark};
        margin-bottom: 15px;
        transform: skewX(-5deg);
      }

      .gal-input-title span {
        transform: skewX(5deg);
        display: block;
      }

      .gal-input-field {
        width: 100%;
        border: 2px solid ${THEME.dark};
        padding: 12px 15px;
        font-size: 1rem;
        font-family: ${THEME.fontMain};
        resize: vertical;
        min-height: 80px;
        box-sizing: border-box;
      }

      .gal-input-field:focus {
        outline: none;
        border-color: ${THEME.accent};
        box-shadow: 0 0 0 3px rgba(0, 210, 255, 0.2);
      }

      .gal-input-actions {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
        margin-top: 15px;
      }

      /* Toast 通知 */
      .gal-toast {
        position: fixed;
        bottom: 30px;
        right: 30px;
        background: ${THEME.dark};
        color: ${THEME.white};
        padding: 12px 25px;
        font-weight: 600;
        transform: skewX(-5deg);
        box-shadow: 5px 5px 0 ${THEME.accent};
        z-index: 100000;
        animation: galToastIn 0.3s ease;
      }

      .gal-toast span {
        display: block;
        transform: skewX(5deg);
      }

      @keyframes galToastIn {
        from { opacity: 0; transform: skewX(-5deg) translateY(20px); }
        to { opacity: 1; transform: skewX(-5deg) translateY(0); }
      }

      /* 立绘配置弹窗 */
      .gal-config-modal {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.6);
        backdrop-filter: blur(6px);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .gal-config-panel {
        background: ${THEME.white};
        border: 3px solid ${THEME.dark};
        box-shadow: 12px 12px 0 rgba(0,0,0,0.2);
        width: 90%;
        max-width: 700px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }

      .gal-config-header {
        background: ${THEME.dark};
        color: ${THEME.white};
        padding: 15px 25px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .gal-config-title {
        font-family: ${THEME.fontEng};
        font-size: 1.2rem;
        font-weight: 800;
        color: ${THEME.accent};
      }

      .gal-config-close {
        background: transparent;
        border: 2px solid ${THEME.white};
        color: ${THEME.white};
        width: 32px;
        height: 32px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;
      }

      .gal-config-close:hover {
        background: ${THEME.accentSub};
        border-color: ${THEME.accentSub};
      }

      .gal-config-body {
        padding: 25px;
        overflow-y: auto;
        flex: 1;
      }

      .gal-sprite-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 15px;
      }

      .gal-sprite-card {
        border: 2px solid #eee;
        padding: 10px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .gal-sprite-card:hover {
        border-color: ${THEME.accent};
        box-shadow: 0 4px 12px rgba(0, 210, 255, 0.15);
      }

      /* 立绘预览图 - 固定2:3长宽比 */
      .gal-sprite-preview {
        width: 100%;
        aspect-ratio: 2 / 3;
        object-fit: cover;
        object-position: top center;
        background: #f9f9f9;
        border-radius: 4px;
        margin-bottom: 8px;
      }

      /* 立绘裁剪工具 */
      .gal-crop-container {
        position: relative;
        width: 100%;
        overflow: visible;
        background: #1a1a2e;
        border-radius: 8px;
      }

      .gal-crop-canvas-wrapper {
        position: relative;
        width: 100%;
        height: 380px;
        overflow: hidden;
        cursor: move;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #1a1a2e;
        border-radius: 8px 8px 0 0;
      }

      #gal-crop-canvas {
        display: block;
      }

      .gal-crop-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
      }

      .gal-crop-frame {
        position: absolute;
        border: 3px solid ${THEME.accent};
        box-shadow: 0 0 0 9999px rgba(0,0,0,0.6);
        pointer-events: none;
      }

      .gal-crop-controls {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 15px;
        padding: 12px 20px;
        background: rgba(0,0,0,0.8);
        border-radius: 0 0 8px 8px;
      }

      .gal-crop-controls .gal-crop-btn {
        padding: 8px 16px;
        min-width: 60px;
        font-size: 0.9rem;
      }

      .gal-crop-zoom-slider {
        width: 150px;
        accent-color: ${THEME.accent};
      }

      .gal-crop-zoom-label {
        color: #fff;
        font-size: 0.85rem;
        font-weight: 600;
        min-width: 45px;
      }

      .gal-crop-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
      }

      .gal-crop-btn.reset {
        background: #666;
        color: #fff;
      }

      .gal-crop-btn.reset:hover {
        background: #888;
      }

      /* 批量上传网格 */
      .gal-batch-upload-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 15px;
        max-height: 60vh;
        overflow-y: auto;
        padding: 5px;
      }

      .gal-batch-upload-card {
        border: 2px dashed #ccc;
        border-radius: 8px;
        padding: 12px;
        text-align: center;
        transition: all 0.2s;
        background: #fafafa;
      }

      .gal-batch-upload-card:hover {
        border-color: ${THEME.accent};
        background: rgba(0, 210, 255, 0.05);
      }

      .gal-batch-upload-card.has-image {
        border-style: solid;
        border-color: ${THEME.accent};
      }

      .gal-batch-upload-card .expression-label {
        font-weight: 700;
        color: ${THEME.dark};
        margin-bottom: 10px;
        font-size: 0.9rem;
      }

      .gal-batch-upload-card .upload-preview {
        width: 100%;
        aspect-ratio: 2 / 3;
        background: #eee;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .gal-batch-upload-card .upload-preview img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: top center;
      }

      .gal-batch-upload-card .upload-preview i {
        font-size: 2rem;
        color: #bbb;
      }

      .gal-batch-upload-card .upload-preview:hover i {
        color: ${THEME.accent};
      }

      .gal-batch-upload-card .remove-btn {
        background: ${THEME.accentSub};
        color: #fff;
        border: none;
        padding: 4px 10px;
        border-radius: 4px;
        font-size: 0.75rem;
        cursor: pointer;
        display: none;
      }

      .gal-batch-upload-card.has-image .remove-btn {
        display: inline-block;
      }

      .gal-sprite-label {
        font-size: 0.85rem;
        font-weight: 700;
        color: ${THEME.dark};
        line-height: 1.3;
      }

      .gal-sprite-label small {
        font-weight: 400;
        color: #888;
      }

      /* 上传卡片 */
      .gal-upload-card {
        border: 2px dashed #ccc;
        padding: 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: #999;
        min-height: 120px;
      }

      .gal-upload-card:hover {
        border-color: ${THEME.accent};
        color: ${THEME.accent};
        background: rgba(0, 210, 255, 0.05);
      }

      .gal-upload-card i {
        font-size: 2rem;
      }

      .gal-action-btn.primary {
        background: ${THEME.accent};
        color: ${THEME.dark};
        border-color: ${THEME.accent};
      }

      .gal-action-btn.primary:hover {
        background: ${THEME.dark};
        color: ${THEME.accent};
      }

      /* ═══════════════════════════════════════════════════════════════
         选项面板 - 从骰子系统监控并重新渲染
         ═══════════════════════════════════════════════════════════════ */

      /* 选项层 - 全屏覆盖（无模糊背景） */
      #gal-layer-choices {
        position: fixed !important;
        top: 0 !important; left: 0 !important;
        width: 100% !important; height: 100% !important;
        background: rgba(0, 0, 0, 0.4) !important;
        z-index: 2147483647 !important;
        display: none;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        gap: 15px;
        padding: 20px;
      }

      #gal-layer-choices.active {
        display: flex;
        animation: galFadeIn 0.3s ease;
      }

      /* 选项标题 */
      .gal-choices-title {
        font-family: ${THEME.fontEng};
        font-size: 1.2rem;
        font-weight: 900;
        color: ${THEME.white};
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 8px;
        transform: skewX(-10deg);
      }

      .gal-choices-title span {
        display: block;
        transform: skewX(10deg);
      }

      /* 选项卡片 - 缩小字体，自适应宽度 */
      .gal-choice-card {
        background: ${THEME.white};
        color: ${THEME.dark};
        padding: 12px 30px;
        min-width: 200px;
        max-width: 90%;
        width: auto;
        text-align: center;
        font-weight: 600;
        font-size: 0.95rem;
        line-height: 1.4;
        border: 2px solid ${THEME.dark};
        box-shadow: 6px 6px 0 rgba(0,0,0,0.15);
        transform: skewX(-8deg);
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        position: relative;
        overflow: hidden;
        word-break: break-word;
      }

      .gal-choice-card span {
        display: block;
        transform: skewX(8deg);
      }

      .gal-choice-card:hover {
        background: ${THEME.accent};
        color: #fff;
        border-color: ${THEME.dark};
        transform: skewX(-8deg) translate(-3px, -3px);
        box-shadow: 9px 9px 0 ${THEME.dark};
      }

      .gal-choice-card::after {
        content: '';
        display: none;
      }

      /* 关闭提示 */
      .gal-choices-hint {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.7);
        margin-top: 15px;
      }

      /* 进度条容器 */
      .gal-progress-container {
        flex: 1;
        height: 6px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
        margin: 0 10px;
        overflow: hidden;
        position: relative;
        min-width: 60px;
      }

      /* 进度条滑块 */
      .gal-progress-bar {
        height: 100%;
        background: linear-gradient(90deg, ${THEME.accent} 0%, #00a8cc 100%);
        width: 0%;
        border-radius: 3px;
        transition: width 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        box-shadow: 0 0 10px ${THEME.accent};
      }

      /* 待选择提示按钮 - 在工具栏内 */
      .gal-pending-choices-btn {
        background: linear-gradient(135deg, ${THEME.accentSub} 0%, #cc0044 100%) !important;
        color: #fff !important;
        padding: 0 20px !important;
        font-weight: 700 !important;
        font-size: 0.85rem !important;
        cursor: pointer !important;
        display: none;
        align-items: center !important;
        gap: 6px !important;
        border: 2px solid ${THEME.dark} !important;
        height: 45px !important;
        margin-right: 5px !important;
        border-radius: 0 !important;
        transform: skewX(-10deg);
      }

      .gal-pending-choices-btn.show {
        display: flex !important;
        -webkit-animation: galPendingPulse 2s ease-in-out infinite !important;
        animation: galPendingPulse 2s ease-in-out infinite !important;
      }

      .gal-pending-choices-btn i, .gal-pending-choices-btn span {
        transform: skewX(10deg) !important;
      }

      .gal-pending-choices-btn:hover {
        filter: brightness(1.1) !important;
        transform: skewX(-10deg) translateY(-2px) !important;
        box-shadow: 5px 5px 0 rgba(0,0,0,0.2) !important;
      }

      @-webkit-keyframes galPendingPulse {
        0%, 100% {
            box-shadow:
                inset 0 0 15px rgba(255,255,255,0.3),
                0 0 15px rgba(255, 215, 0, 0.6),
                0 0 25px rgba(255, 215, 0, 0.4),
                3px 3px 0 rgba(0,0,0,0.1);
            filter: brightness(1);
        }
        50% {
            box-shadow:
                inset 0 0 30px rgba(255,255,255,0.6),
                0 0 30px rgba(255, 215, 0, 0.8),
                0 0 50px rgba(255, 215, 0, 0.5),
                3px 3px 0 rgba(0,0,0,0.1);
            filter: brightness(1.25);
        }
      }

      @keyframes galPendingPulse {
        0%, 100% {
            box-shadow:
                inset 0 0 15px rgba(255,255,255,0.3),
                0 0 15px rgba(255, 215, 0, 0.6),
                0 0 25px rgba(255, 215, 0, 0.4),
                3px 3px 0 rgba(0,0,0,0.1);
            filter: brightness(1);
        }
        50% {
            box-shadow:
                inset 0 0 30px rgba(255,255,255,0.6),
                0 0 30px rgba(255, 215, 0, 0.8),
                0 0 50px rgba(255, 215, 0, 0.5),
                3px 3px 0 rgba(0,0,0,0.1);
            filter: brightness(1.25);
        }
      }

      .gal-pending-choices-btn.gal-new-option-highlight {
        -webkit-animation: galNewOptionPop 0.6s ease-out, galPendingPulse 2s ease-in-out infinite !important;
        animation: galNewOptionPop 0.6s ease-out, galPendingPulse 2s ease-in-out infinite !important;
      }

      @-webkit-keyframes galNewOptionPop {
        0% { transform: skewX(-10deg) scale(0.95); opacity: 0.8; }
        50% { transform: skewX(-10deg) scale(1.1); }
        100% { transform: skewX(-10deg) scale(1); opacity: 1; }
      }

      @keyframes galNewOptionPop {
        0% { transform: skewX(-10deg) scale(0.95); opacity: 0.8; }
        50% { transform: skewX(-10deg) scale(1.1); }
        100% { transform: skewX(-10deg) scale(1); opacity: 1; }
      }

      /* Galgame 开启按钮 (注入到消息中) */
      .gal-open-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        background: transparent;
        color: ${THEME.accent};
        border: 1px solid ${THEME.accent};
        border-radius: 4px;
        font-size: 0.75rem;
        cursor: pointer;
        opacity: 0.6;
        transition: all 0.2s;
        margin-left: 5px;
        font-family: ${THEME.fontMain};
      }

      .gal-open-btn:hover {
        opacity: 1;
        background: ${THEME.accent};
        color: ${THEME.dark};
      }

      /* 历史记录模态框 */
      .gal-history-modal {
        position: fixed !important;
        top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
        background: rgba(0,0,0,0.85) !important;
        backdrop-filter: blur(5px) !important;
        z-index: 2147483647 !important;
        display: flex;
        align-items: center;
        justify-content: center;
        animation: galFadeIn 0.3s ease;
      }

      .gal-history-panel {
        background: ${THEME.white};
        border: 2px solid ${THEME.accent};
        box-shadow: 0 0 20px rgba(0, 210, 255, 0.3);
        width: 80%;
        max-width: 800px;
        height: 80vh;
        display: flex;
        flex-direction: column;
        border-radius: 8px;
        overflow: hidden;
      }

      .gal-history-header {
        background: ${THEME.dark};
        color: ${THEME.white};
        padding: 15px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 2px solid ${THEME.accent};
      }

      .gal-history-title {
        font-family: ${THEME.fontMain};
        font-size: 1.2rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .gal-history-close {
        background: transparent;
        border: none;
        color: #aaa;
        font-size: 1.5rem;
        cursor: pointer;
        transition: color 0.2s;
        line-height: 1;
      }

      .gal-history-close:hover {
        color: ${THEME.accent};
      }

      .gal-history-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px;
        background: #f5f5f5;
      }

      .gal-history-list {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }

      .gal-history-item {
        background: #fff;
        padding: 0;
        border-radius: 8px;
        border: 1px solid #eee;
        box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        transition: all 0.2s;
        overflow: hidden;
        margin-bottom: 10px;
      }

      .gal-history-item:hover {
        box-shadow: 0 8px 20px rgba(0, 210, 255, 0.15);
        transform: translateY(-2px);
        border-color: ${THEME.accent};
      }

      .gal-history-header-row {
        background: #f8f9fa;
        padding: 10px 20px;
        border-bottom: 1px solid #eee;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .gal-history-info-group {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .gal-history-index {
        background: ${THEME.accent};
        color: ${THEME.dark};
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.8rem;
        font-weight: 700;
        font-family: ${THEME.fontEng};
      }

      .gal-history-time {
        color: #666;
        font-size: 0.9rem;
        font-weight: 600;
        font-family: ${THEME.fontMain};
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .gal-history-time i {
        font-size: 0.8rem;
        color: #999;
      }

      .gal-history-content {
        padding: 20px;
        font-size: 1.05rem;
        line-height: 1.8;
        color: #333;
        white-space: pre-wrap;
        text-align: justify;
      }

      .gal-history-empty {
        text-align: center;
        padding: 50px;
        color: #999;
        font-style: italic;
      }

      .galgame-database-container {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 100% !important;
        height: 100% !important;
        z-index: 2147483647 !important;
        display: none;
      }

      /* 2024-01-26 更新样式 */
      .gal-open-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%);
          color: #fff;
          border: none;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 2px 8px rgba(0, 210, 255, 0.3);
      }

      .gal-open-btn:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 15px rgba(0, 210, 255, 0.5);
      }

      /* ═══════════════════════════════════════════════════════════════
         背景管理实时生成开关 - 美化版
         ═══════════════════════════════════════════════════════════════ */
      .gal-realtime-toggle-wrapper {
        display: flex !important;
        align-items: center !important;
        gap: 8px;
      }

      .gal-realtime-label {
        font-size: 0.9rem !important;
        color: #2b2e38 !important;
        font-weight: 600 !important;
        white-space: nowrap;
      }

      .gal-realtime-switch {
        position: relative;
        display: inline-block;
        width: 52px;
        height: 28px;
        flex-shrink: 0;
      }

      .gal-realtime-switch input {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
      }

      .gal-realtime-slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background: linear-gradient(145deg, #d0d0d0 0%, #b8b8b8 100%);
        transition: all 0.3s ease;
        border-radius: 28px;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);
      }

      .gal-realtime-slider::before {
        content: "";
        position: absolute;
        height: 22px;
        width: 22px;
        left: 3px;
        bottom: 3px;
        background: linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%);
        transition: transform 0.3s ease;
        border-radius: 50%;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        z-index: 2;
      }

      .gal-realtime-slider::after {
        content: "OFF";
        position: absolute;
        right: 8px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 9px;
        font-weight: 700;
        color: #666;
        z-index: 1;
      }

      .gal-realtime-switch input:checked + .gal-realtime-slider {
        background: linear-gradient(135deg, ${THEME.accent} 0%, ${THEME.accentSub} 100%);
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.2), 0 0 12px rgba(0, 210, 255, 0.4);
      }

      .gal-realtime-switch input:checked + .gal-realtime-slider::before {
        transform: translateX(24px);
      }

      .gal-realtime-switch input:checked + .gal-realtime-slider::after {
        content: "ON";
        left: 8px;
        right: auto;
        color: rgba(255,255,255,0.95);
      }
`;
    const styleEl = targetDoc.createElement('style');
    styleEl.id = `${SCRIPT_ID}-styles`;
    styleEl.textContent = css;
    (targetDoc.head || targetDoc.documentElement).appendChild(styleEl);
    console.log(`[${SCRIPT_NAME}] 样式已注入`);
  }
  // ============================================
  // UI 渲染 - 全局覆盖层架构
  // ============================================
  // 当前显示的消息ID
  let currentDisplayMesId = null;
  /**
   * 创建或获取全局Galgame覆盖层
   */
  function ensureGlobalOverlay() {
    const targetDoc = topWindow.document;
    let $overlay = $(targetDoc).find('#gal-global-overlay');
    if (!$overlay.length) {
      const overlayHtml = `
        <div id="gal-global-overlay">
          <!-- 地点时间状态栏 -->
          <div class="gal-status-bar-container">
            <div class="gal-location-bar" id="gal-location-bar" title="当前地点">
              <i class="fa-solid fa-location-dot"></i>
              <span class="gal-location-text" id="gal-location-text">--</span>
            </div>
            <div class="gal-time-bar" id="gal-time-bar" title="当前时间">
              <i class="fa-regular fa-clock"></i>
              <span class="gal-time-text" id="gal-time-text">--</span>
            </div>
          </div>

          <!-- 全屏切换按钮 -->
          <button class="gal-fullscreen-btn" data-action="toggle-fullscreen" title="切换全屏">
            <i class="fa-solid fa-expand"></i>
            <span>全屏</span>
          </button>

          <div class="gal-game-container">
            <!-- 背景层 -->
            <div class="gal-layer-bg"></div>

            <!-- 立绘层 - 由SpriteManager动态管理 -->
            <div class="gal-layer-character${settings.speakerGlow ? ' glow-enabled' : ''}${settings.speakerBubble ? ' bubble-enabled' : ''}"></div>

            <!-- 对话框层 -->
            <div class="gal-dialog-layer">
              <div class="gal-name-badge">
                <span>旁白</span>
              </div>

              <div class="gal-interaction-bar">
                <button class="gal-action-btn btn-reroll" data-action="reroll" title="重新生成">
                  <i class="fa-solid fa-rotate-right"></i>
                  <span>重绘当前</span>
                </button>
                <button class="gal-action-btn btn-free" data-action="free-input" title="自由输入">
                  <i class="fa-regular fa-keyboard"></i>
                  <span>自由对话</span>
                </button>
              </div>

              <div class="gal-text-panel">
                <p class="gal-dialog-text"></p>

                <div class="gal-bottom-toolbar">
                  <button class="gal-footer-btn" data-action="log" title="查看历史">
                    <i class="fa-solid fa-list-ul"></i> LOG
                  </button>
                  <button class="gal-footer-btn" data-action="close-mode" title="退出 Galgame 模式">
                    <i class="fa-solid fa-power-off"></i> CLOSE
                  </button>
                  <button class="gal-footer-btn" data-action="config" title="设置">
                    <i class="fa-solid fa-gear"></i> CONFIG
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="prev" title="上一段">
                    <i class="fa-solid fa-chevron-left"></i> PREV
                  </button>
                  <div class="gal-progress-container">
                    <div class="gal-progress-bar"></div>
                  </div>
                  <button class="gal-footer-btn gal-nav-btn" data-action="auto" title="自动播放">
                    <i class="fa-solid fa-play"></i> AUTO
                  </button>
                  <button class="gal-footer-btn gal-nav-btn" data-action="skip" title="按住快进 (Ctrl)">
                    <i class="fa-solid fa-forward"></i> SKIP
                  </button>
                  <button class="gal-pending-choices-btn" data-action="show-choices" title="有待选择的选项">
                    <i class="fa-solid fa-list-check"></i> 选项
                  </button>
                  <button class="gal-footer-btn-next" data-action="next" title="下一段">
                    NEXT <i class="fa-solid fa-chevron-right"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      // 插入到 #chat 容器末尾（内联模式）
      const $chat = $(targetDoc).find('#chat');
      if ($chat.length) {
        $chat.append(overlayHtml);
      } else {
        // 回退：如果找不到 #chat，插入到 body
        $(targetDoc.body).append(overlayHtml);
      }
      $overlay = $(targetDoc).find('#gal-global-overlay');
    }
    return $overlay;
  }
  /**
   * 渲染主界面（确保容器存在）
   * 对标骰子系统的渲染逻辑，解决容器丢失问题
   */
  function renderMainInterface() {
    const targetDoc = topWindow.document;
    // 确保容器存在
    let container = targetDoc.getElementById('galgame-database-container');
    if (!container) {
      container = targetDoc.createElement('div');
      container.id = 'galgame-database-container';
      container.className = 'galgame-database-container';
      targetDoc.body.appendChild(container); // 明确挂载到 body
      console.log(`[${SCRIPT_NAME}] 已创建 galgame-database-container 容器`);
    }
    container.style.display = 'block';
    return container;
  }
  /**
   * 显示全局Galgame覆盖层
   */
  function showGlobalOverlay() {
    const $overlay = ensureGlobalOverlay();
    $overlay.addClass('active');
    console.log(`[${SCRIPT_NAME}] 显示全局Galgame覆盖层`);
  }
  /**
   * 隐藏全局Galgame覆盖层
   */
  function hideGlobalOverlay() {
    const targetDoc = topWindow.document;
    $(targetDoc).find('#gal-global-overlay').removeClass('active');
    console.log(`[${SCRIPT_NAME}] 隐藏全局Galgame覆盖层`);
  }
  /**
   * 切换全局覆盖层显示状态
   */
  function toggleGlobalOverlay() {
    const $overlay = ensureGlobalOverlay();
    if ($overlay.hasClass('active')) {
      hideGlobalOverlay();
    } else {
      showGlobalOverlay();
    }
  }
  /**
   * 切换全屏模式（使用浏览器Fullscreen API实现真正全屏）
   */
  function toggleFullscreen() {
    return __awaiter(this, void 0, void 0, function* () {
      const overlay = topWindow.document.getElementById('gal-global-overlay');
      const $btn = $(overlay).find('[data-action="toggle-fullscreen"]');
      // 判断当前是否处于全屏状态
      const isCurrentlyFullscreen =
        topWindow.document.fullscreenElement ||
        topWindow.document.webkitFullscreenElement ||
        topWindow.document.mozFullScreenElement ||
        topWindow.document.msFullscreenElement;
      if (isCurrentlyFullscreen) {
        // 退出全屏
        try {
          if (topWindow.document.exitFullscreen) {
            yield topWindow.document.exitFullscreen();
          } else if (topWindow.document.webkitExitFullscreen) {
            yield topWindow.document.webkitExitFullscreen();
          } else if (topWindow.document.mozCancelFullScreen) {
            yield topWindow.document.mozCancelFullScreen();
          } else if (topWindow.document.msExitFullscreen) {
            yield topWindow.document.msExitFullscreen();
          }
          $(overlay).removeClass('fullscreen');
          $btn.html('<i class="fa-solid fa-expand"></i><span>全屏</span>');
          console.log(`[${SCRIPT_NAME}] 退出全屏模式`);
        } catch (e) {
          console.error(`[${SCRIPT_NAME}] 退出全屏失败:`, e);
        }
      } else {
        // 进入全屏
        try {
          if (overlay.requestFullscreen) {
            yield overlay.requestFullscreen();
          } else if (overlay.webkitRequestFullscreen) {
            yield overlay.webkitRequestFullscreen();
          } else if (overlay.mozRequestFullScreen) {
            yield overlay.mozRequestFullScreen();
          } else if (overlay.msRequestFullscreen) {
            yield overlay.msRequestFullscreen();
          }
          $(overlay).addClass('fullscreen');
          $btn.html('<i class="fa-solid fa-compress"></i><span>退出</span>');
          console.log(`[${SCRIPT_NAME}] 进入全屏模式`);
        } catch (e) {
          console.error(`[${SCRIPT_NAME}] 进入全屏失败:`, e);
          showToast('全屏请求失败，请检查浏览器权限');
        }
      }
    });
  }
  // 监听全屏变化事件，同步按钮状态
  function setupFullscreenChangeListener() {
    const handleFullscreenChange = () => {
      const overlay = topWindow.document.getElementById('gal-global-overlay');
      if (!overlay) return;
      const $btn = $(overlay).find('[data-action="toggle-fullscreen"]');
      const isFullscreen =
        topWindow.document.fullscreenElement ||
        topWindow.document.webkitFullscreenElement ||
        topWindow.document.mozFullScreenElement ||
        topWindow.document.msFullscreenElement;
      if (isFullscreen) {
        $(overlay).addClass('fullscreen');
        $btn.html('<i class="fa-solid fa-compress"></i><span>退出</span>');
      } else {
        $(overlay).removeClass('fullscreen');
        $btn.html('<i class="fa-solid fa-expand"></i><span>全屏</span>');
      }
    };
    topWindow.document.addEventListener('fullscreenchange', handleFullscreenChange);
    topWindow.document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    topWindow.document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    topWindow.document.addEventListener('MSFullscreenChange', handleFullscreenChange);
  }
  // ============================================
  // 历史记录功能
  // ============================================
  // 从数据库获取历史记录
  function getHistoryFromDatabase() {
    try {
      const api = topWindow.AutoCardUpdaterAPI;
      if (!api || typeof api.exportTableAsJson !== 'function') {
        console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 不可用`);
        return [];
      }
      const tableData = api.exportTableAsJson();
      if (!tableData) return [];
      // 查找 "总结表"
      let summarySheet = null;
      for (const sheetKey of Object.keys(tableData)) {
        if (!sheetKey.startsWith('sheet_')) continue;
        const sheet = tableData[sheetKey];
        if (sheet.name === '总结表') {
          summarySheet = sheet;
          break;
        }
      }
      if (!summarySheet || !summarySheet.content || summarySheet.content.length < 2) {
        console.log(`[${SCRIPT_NAME}] 未找到总结表或表为空`);
        return [];
      }
      const headers = summarySheet.content[0];
      const content = summarySheet.content;
      console.log(`[${SCRIPT_NAME}] 总结表表头:`, headers);
      // 查找列索引
      let indexCol = -1;
      let timeCol = -1;
      let contentCol = -1;
      // 常见列名匹配
      const indexKeywords = ['索引', '编码', 'index', 'id', '序号', '编号'];
      const timeKeywords = ['时间', '跨度', '日期', 'time', 'date', 'duration'];
      const contentKeywords = ['纪要', '总结', '内容', '文本', 'summary', 'content', 'text', '剧情', '故事'];
      headers.forEach((header, idx) => {
        if (!header) return;
        const h = String(header).toLowerCase().trim();
        if (indexCol === -1 && indexKeywords.some(k => h === k || h.includes(k))) {
          indexCol = idx;
        }
        if (timeCol === -1 && timeKeywords.some(k => h === k || h.includes(k))) {
          timeCol = idx;
        }
        if (contentCol === -1 && contentKeywords.some(k => h === k || h.includes(k))) {
          contentCol = idx;
        }
      });
      // 如果未找到内容列，尝试智能推断：寻找平均长度最长的列
      if (contentCol === -1) {
        console.log(`[${SCRIPT_NAME}] 未能通过表头识别内容列，尝试分析数据内容...`);
        // 采样前5行数据
        let maxAvgLength = 0;
        let bestCol = -1;
        // 遍历所有列
        for (let colIdx = 0; colIdx < headers.length; colIdx++) {
          // 跳过已识别的索引列
          if (colIdx === indexCol) continue;
          let totalLen = 0;
          let count = 0;
          for (let rowIdx = 1; rowIdx < Math.min(content.length, 6); rowIdx++) {
            const cell = content[rowIdx][colIdx];
            if (cell && typeof cell === 'string') {
              totalLen += cell.length;
              count++;
            }
          }
          const avgLen = count > 0 ? totalLen / count : 0;
          if (avgLen > maxAvgLength) {
            maxAvgLength = avgLen;
            bestCol = colIdx;
          }
        }
        if (bestCol !== -1) {
          contentCol = bestCol;
          console.log(`[${SCRIPT_NAME}] 自动推断内容列为索引: ${contentCol} (平均长度: ${maxAvgLength})`);
        }
      }
      // 最后的后备方案：如果有至少2列，取第2列作为内容；否则取第1列
      if (contentCol === -1) {
        if (headers.length >= 2) {
          contentCol = 1;
          if (indexCol === 1) contentCol = 0; // 避免冲突
        } else {
          contentCol = 0;
        }
      }
      // 确保索引列不是内容列
      if (indexCol === -1 && contentCol !== 0) {
        indexCol = 0;
      }
      // 如果找不到时间列，但有至少3列，且内容列是第3列(2)或之后，尝试用前一列作为时间列
      if (timeCol === -1 && headers.length >= 3 && contentCol >= 1 && contentCol !== indexCol) {
        // 简单启发式：如果内容列是2，时间列可能是1
        timeCol = contentCol - 1;
        if (timeCol === indexCol) timeCol = -1; // 避免冲突
      }
      console.log(`[${SCRIPT_NAME}] 最终使用列 - 索引: ${indexCol}, 时间: ${timeCol}, 内容: ${contentCol}`);
      const history = [];
      // 从第1行开始遍历（跳过表头）
      for (let i = 1; i < content.length; i++) {
        const row = content[i];
        if (!row) continue;
        const text = row[contentCol];
        const idx = indexCol !== -1 ? row[indexCol] : '';
        const time = timeCol !== -1 ? row[timeCol] : '';
        if (text) {
          history.push({
            index: idx,
            time: time,
            content: text,
          });
        }
      }
      return history;
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 获取历史记录失败:`, e);
      return [];
    }
  }
  // 显示历史记录模态框
  function showHistoryModal(historyData) {
    // 移除已存在的模态框
    $('#gal-history-modal').remove();
    const $modal = $(`<div id="gal-history-modal" class="gal-history-modal"></div>`);
    let listHtml = '';
    if (!historyData || historyData.length === 0) {
      listHtml = '<div class="gal-history-empty">暂无历史记录</div>';
    } else {
      listHtml = '<div class="gal-history-list">';
      historyData.forEach(item => {
        listHtml += `
          <div class="gal-history-item">
            <div class="gal-history-header-row">
              <div class="gal-history-info-group">
                ${item.index ? `<span class="gal-history-index">#${item.index}</span>` : ''}
                ${item.time ? `<span class="gal-history-time"><i class="fa-regular fa-clock"></i> ${item.time}</span>` : ''}
              </div>
            </div>
            <div class="gal-history-content">${item.content}</div>
          </div>
        `;
      });
      listHtml += '</div>';
    }
    const modalHtml = `
      <div class="gal-history-panel">
        <div class="gal-history-header">
          <div class="gal-history-title">
            <i class="fa-solid fa-clock-rotate-left"></i>
            <span>剧情回顾</span>
          </div>
          <button class="gal-history-close">&times;</button>
        </div>
        <div class="gal-history-body">
          ${listHtml}
        </div>
      </div>
    `;
    $modal.html(modalHtml);
    $('body').append($modal);
    // 绑定关闭事件
    $modal.find('.gal-history-close').on('click', function () {
      $modal.fadeOut(200, function () {
        $(this).remove();
      });
    });
    // 点击遮罩层关闭
    $modal.on('click', function (e) {
      if (e.target === this) {
        $modal.fadeOut(200, function () {
          $(this).remove();
        });
      }
    });
    // 自动滚动到底部
    const $body = $modal.find('.gal-history-body');
    $body.scrollTop($body[0].scrollHeight);
  }
  /**
   * 更新全局覆盖层的内容
   */
  function updateGlobalOverlayContent(mesId, parsedContent) {
    return __awaiter(this, void 0, void 0, function* () {
      console.log(`[${SCRIPT_NAME}] [DEBUG] updateGlobalOverlayContent CALLED for mesId=${mesId}`);
      var _a;
      const $overlay = ensureGlobalOverlay();
      const segments = parsedContent.segments;
      // 获取或初始化当前消息的段落状态
      let state = messageSegmentState.get(String(mesId));
      if (!state) {
        state = { currentIndex: 0, segments: segments, parsedContent: parsedContent };
        messageSegmentState.set(String(mesId), state);
      } else {
        state.segments = segments;
        state.parsedContent = parsedContent;
      }
      // 重置 SpriteManager（仅当切换到新消息时，防止流式输出导致重复入场动画）
      const isNewMessage = currentDisplayMesId !== mesId;
      if (isNewMessage) {
        SpriteManager.reset($overlay);
      }
      currentDisplayMesId = mesId;
      // 显示当前索引的段落
      const currentIndex = Math.min(state.currentIndex, segments.length - 1);
      const displaySegment = segments[currentIndex] || { type: 'narration', text: '' };
      const displayText = displaySegment.text || '';
      const speaker = displaySegment.speaker;
      const isNarration = displaySegment.type === 'narration';
      const progressText = `${currentIndex + 1}/${segments.length}`;
      // 更新UI元素
      const $nameBadge = $overlay.find('.gal-name-badge');
      $nameBadge.find('span').text(speaker || '旁白');
      if (isNarration) {
        $nameBadge.addClass('gal-narrator-label');
      } else {
        $nameBadge.removeClass('gal-narrator-label');
      }
      $overlay.find('.gal-dialog-text').text(displayText);
      // 计算百分比
      const total = segments.length;
      // 确保至少有1个，避免除以0
      const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
      $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);
      // 使用 SpriteManager 更新立绘（支持多角色、动画）
      const expression = displaySegment.expression || '默认';
      yield SpriteManager.updateSprite($overlay, speaker, expression);
      // 应用场景色调和背景
      if ((_a = parsedContent.currentBackground) === null || _a === void 0 ? void 0 : _a.scene) {
        yield SpriteManager.applySceneTint($overlay, parsedContent.currentBackground.scene);
      }
      // 更新NEXT按钮状态
      const $nextBtn = $overlay.find('[data-action="next"]');
      // ★ 再次尝试获取下一段，直接判断是否真的有下一段内容
      // 这是最可靠的判断方式，不依赖于索引计算
      const hasNextSegment = !!segments[currentIndex + 1];
      if (!hasNextSegment) {
        $nextBtn.html('END <i class="fa-solid fa-check"></i>');
      } else {
        $nextBtn.html('NEXT <i class="fa-solid fa-chevron-right"></i>');
      }
      // 存储mesId到容器
      $overlay.find('.gal-game-container').attr('data-mes-id', mesId);

      // 更新地点时间显示
      updateLocationTimeDisplay();

      // ★ TTS: 首次显示新消息时自动播放当前段落（如果是对话）
      if (isNewMessage && settings.ttsEnabled && settings.ttsAutoPlay && !isNarration) {
        const segmentId = `${mesId}_${currentIndex}`;
        TTSManager.stop(); // 先清空队列
        TTSManager.speak(displaySegment, segmentId);
      }

      console.log(`[${SCRIPT_NAME}] 更新全局覆盖层内容: mesId=${mesId}, 段落=${currentIndex + 1}/${segments.length}`);
    });
  }
  /**
   * 获取最后一条AI消息的内容并更新覆盖层
   */
  function refreshOverlayFromLastAiMessage() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!isEnabled) return;
      // 找到最后一条AI消息
      const $allMes = $('#chat > .mes');
      let $lastAiMes = null;
      $allMes.each(function () {
        if ($(this).attr('is_user') !== 'true') {
          $lastAiMes = $(this);
        }
      });
      if (!$lastAiMes || !$lastAiMes.length) {
        console.log(`[${SCRIPT_NAME}] 未找到AI消息`);
        return;
      }
      const mesId = $lastAiMes.attr('mesid');
      // ★ 优先从 SillyTavern chat 数组获取原始消息（保留自定义标签）
      let contentToProcess = getRawMessageContent(mesId);
      // 回退到 DOM 内容
      if (!contentToProcess) {
        const $mesText = $lastAiMes.find('.mes_text');
        const html = $mesText.html();
        if (!html) return;
        contentToProcess = decodeHtml(html);
      }
      const hasGalTags = /<(p|sprite|maintext|background)[^>]*>/i.test(contentToProcess);
      if (!hasGalTags) {
        console.log(`[${SCRIPT_NAME}] 最后AI消息不包含Galgame标签`);
        return;
      }
      const parsed = parseGalgameContent(contentToProcess);
      if (parsed.segments.length === 0) return;
      // 更新覆盖层内容
      yield updateGlobalOverlayContent(mesId, parsed);
      // 显示覆盖层
      showGlobalOverlay();
      updateLocationTimeDisplay();
    });
  }
  // 保留旧函数名以兼容
  function renderGalgameMessage(mesId, parsedContent) {
    return __awaiter(this, void 0, void 0, function* () {
      yield updateGlobalOverlayContent(mesId, parsedContent);
      showGlobalOverlay();
      updateLocationTimeDisplay();
    });
  }
  // 设置全局事件监听器 (委托模式)
  function setupGlobalEventListeners() {
    console.log(`[${SCRIPT_NAME}] 设置全局事件委托...`);
    const doc = topWindow.document;

    // 地点/时间状态栏点击 - 自定义弹窗
    $(doc).on('click', '#gal-location-bar', function (e) {
      e.stopPropagation();
      const customHtml = localStorage.getItem(CUSTOM_LOCATION_HTML_KEY);
      if (customHtml) {
        showCustomPopupPanel('地点详情', customHtml);
      }
    });

    $(doc).on('click', '#gal-time-bar', function (e) {
      e.stopPropagation();
      const customHtml = localStorage.getItem(CUSTOM_TIME_HTML_KEY);
      if (customHtml) {
        showCustomPopupPanel('时间详情', customHtml);
      }
    });

    // PREV按钮长按快退
    $(doc).on('mousedown touchstart', '#gal-global-overlay [data-action="prev"]', function (e) {
      e.stopPropagation();
      e.preventDefault();

      // 开始3秒计时
      rewindHoldTimer = setTimeout(() => {
        startRewinding();
      }, REWIND_HOLD_DELAY);
    });

    // mouseup/touchend: 短按回退逻辑
    $(doc).on('mouseup touchend', '#gal-global-overlay [data-action="prev"]', function (e) {
      e.stopPropagation();
      e.preventDefault();

      // 清除3秒计时器
      if (rewindHoldTimer) {
        clearTimeout(rewindHoldTimer);
        rewindHoldTimer = null;
      }

      // 如果正在快退则停止
      if (isRewinding) {
        stopRewinding();
      } else {
        // 短按则正常的上翻
        triggerPrevSegment();
      }
    });

    // mouseleave: 仅停止快退状态，不执行回退（修复鼠标移过就回退的问题）
    $(doc).on('mouseleave', '#gal-global-overlay [data-action="prev"]', function (e) {
      e.stopPropagation();
      e.preventDefault();

      // 清除3秒计时器
      if (rewindHoldTimer) {
        clearTimeout(rewindHoldTimer);
        rewindHoldTimer = null;
      }

      // 仅停止快退状态，不触发回退
      if (isRewinding) {
        stopRewinding();
      }
    });

    // 自由输入
    $(doc).on('click', '#gal-global-overlay [data-action="free-input"]', function (e) {
      e.stopPropagation();
      showFreeInputModal();
    });
    // 重新Roll
    $(doc).on('click', '#gal-global-overlay [data-action="reroll"]', function (e) {
      e.stopPropagation();
      triggerReroll();
    });
    // 退出 Galgame 模式 (CLOSE 按钮)
    $(doc).on('click', '#gal-global-overlay [data-action="close-mode"]', function (e) {
      return __awaiter(this, void 0, void 0, function* () {
        e.stopPropagation();
        // 1. 先设置标志位
        isEnabled = false;
        setCurrentCharEnabled(false);
        updateButtonState();

        // 2. 停止可能正在进行的自动播放
        $('#gal-global-overlay [data-action="auto"]').each(function () {
          const timer = $(this).data('auto-timer');
          if (timer) clearInterval(timer);
        });

        // 3. 关闭世界书 (如果需要)
        try {
          yield disableWorldbookGlobally();
        } catch (e) {
          console.warn('关闭世界书失败', e);
        }

        // 4. 恢复视图
        restoreOriginalViews();

        // 5. 延迟滚动到最后一条消息
        setTimeout(() => {
          const $lastMes = $('#chat > .mes').last();
          if ($lastMes.length) {
            $lastMes[0].scrollIntoView({ behavior: 'smooth', block: 'end' });
          }
        }, 150);

        showToast('Galgame 模式已关闭');
      });
    });
    // 进入 Galgame 模式 (消息上的按钮)
    $(doc).on('click', '.gal-open-btn', function (e) {
      return __awaiter(this, void 0, void 0, function* () {
        e.stopPropagation();
        const $btn = $(this);
        const $mes = $btn.closest('.mes');
        const mesId = $mes.attr('mesid');
        if (!mesId) return;
        isEnabled = true;
        setCurrentCharEnabled(true);
        updateButtonState();
        // 先更新UI，再异步加载世界书
        showToast('正在开启 Galgame 模式...');
        try {
          yield injectCOTToWorldbook();
          yield enableWorldbookGlobally();
        } catch (err) {
          console.error('Galgame模式开启出错:', err);
        }
        // 尝试渲染被点击的消息
        let contentToProcess = getRawMessageContent(mesId);
        if (!contentToProcess) {
          const $mesText = $mes.find('.mes_text');
          contentToProcess = decodeHtml($mesText.html());
        }
        if (contentToProcess) {
          const parsed = parseGalgameContent(contentToProcess);
          if (parsed.segments.length > 0) {
            yield updateGlobalOverlayContent(mesId, parsed);
            showGlobalOverlay();
            if (settings.hideOtherFloors) hideNonLastFloors();
            showToast('Galgame 模式已开启');
          } else {
            applyGalgameMode();
            if (settings.hideOtherFloors) hideNonLastFloors();
            showToast('Galgame 模式已开启 (当前消息无内容)');
          }
        } else {
          applyGalgameMode();
          if (settings.hideOtherFloors) hideNonLastFloors();
          showToast('Galgame 模式已开启');
        }
      });
    });
    // 快进按钮 (SKIP) - 按下开始，松开停止
    $(doc).on('mousedown touchstart', '#gal-global-overlay [data-action="skip"]', function (e) {
      e.stopPropagation();
      e.preventDefault();
      startSkipping();
    });
    $(doc).on('mouseup touchend mouseleave', '#gal-global-overlay [data-action="skip"]', function (e) {
      e.stopPropagation();
      e.preventDefault();
      stopSkipping();
    });
    // 全屏切换
    $(doc).on('click', '#gal-global-overlay [data-action="toggle-fullscreen"]', function (e) {
      e.stopPropagation();
      toggleFullscreen();
    });
    // 设置按钮
    $(doc).on('click', '#gal-global-overlay [data-action="config"]', function (e) {
      e.stopPropagation();
      showSettingsPanel();
    });
    // LOG按钮
    $(doc).on('click', '#gal-global-overlay [data-action="log"]', function (e) {
      e.stopPropagation();
      const history = getHistoryFromDatabase();
      showHistoryModal(history);
    });
    // 待选择选项按钮
    $(doc).on('click', '#gal-global-overlay [data-action="show-choices"]', function (e) {
      e.stopPropagation();
      if (pendingOptions && pendingOptions.length > 0) {
        renderGalgameChoices(pendingOptions);
      } else {
        showToast('当前没有待选择的选项');
      }
    });
    // NEXT按钮
    $(doc).on('click', '#gal-global-overlay [data-action="next"]', function (e) {
      e.stopPropagation();
      const $overlay = $('#gal-global-overlay');
      const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
      const state = messageSegmentState.get(String(mesId));
      if (!state) return;
      const nextSegment = state.segments[state.currentIndex + 1];
      if (nextSegment) {
        // ★ TTS: 先停止当前播放
        TTSManager.stop();
        // 切换到下一段
        state.currentIndex++;
        updateOverlaySegmentDisplay(state);
        // ★ TTS: 立即播放新段落的TTS（如果是对话）
        if (nextSegment.type === 'dialogue' && settings.ttsEnabled) {
          const segmentId = `${mesId}_${state.currentIndex}`;
          TTSManager.speak(nextSegment, segmentId);
        }
      } else {
        showToast('已是最后一段');
      }
    });
    // PREV按钮
    $(doc).on('click', '#gal-global-overlay [data-action="prev"]', function (e) {
      e.stopPropagation();
      const $overlay = $('#gal-global-overlay');
      const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
      const state = messageSegmentState.get(String(mesId));
      if (!state) return;
      if (state.currentIndex > 0) {
        // ★ TTS: 先停止当前播放
        TTSManager.stop();
        // 切换到上一段
        state.currentIndex--;
        updateOverlaySegmentDisplay(state);
        // ★ TTS: 播放上一段的TTS（如果是对话）
        const prevSegment = state.segments[state.currentIndex];
        if (prevSegment && prevSegment.type === 'dialogue' && settings.ttsEnabled) {
          const segmentId = `${mesId}_${state.currentIndex}`;
          TTSManager.speak(prevSegment, segmentId);
        }
      } else {
        showToast('已是第一段');
      }
    });
    // AUTO按钮
    $(doc).on('click', '#gal-global-overlay [data-action="auto"]', function (e) {
      e.stopPropagation();
      const $btn = $(this);
      const $overlay = $('#gal-global-overlay');
      const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
      let timer = $btn.data('auto-timer');
      if (timer) {
        clearInterval(timer);
        $btn.data('auto-timer', null);
        $btn.html('<i class="fa-solid fa-play"></i> AUTO');
        $btn.removeClass('gal-auto-playing');
        // ★ TTS: 停止自动播放时同时停止TTS
        TTSManager.stop();
      } else {
        $btn.html('<i class="fa-solid fa-pause"></i> STOP');
        $btn.addClass('gal-auto-playing');

        // ★ TTS: 启动自动播放前先停止当前
        TTSManager.stop();
        // ★ TTS: 立即播放下一句（如果启用TTS且当前是对话）
        const state = messageSegmentState.get(String(mesId));
        if (state && settings.ttsEnabled) {
          const currentSegment = state.segments[state.currentIndex];
          if (currentSegment && currentSegment.type === 'dialogue') {
            const segmentId = `${mesId}_${state.currentIndex}`;
            TTSManager.speak(currentSegment, segmentId);
          }
        }

        timer = setInterval(() => {
          const state = messageSegmentState.get(String(mesId));
          if (!state) {
            clearInterval(timer);
            $btn.data('auto-timer', null);
            return;
          }
          const hasNext = !!state.segments[state.currentIndex + 1];
          if (hasNext) {
            // ★ TTS: 切换前停止当前播放
            TTSManager.stop();
            // 切换到下一段
            state.currentIndex++;
            updateOverlaySegmentDisplay(state);
            // ★ TTS: 播放新段落的TTS（如果是对话）
            if (settings.ttsEnabled) {
              const currentSegment = state.segments[state.currentIndex];
              if (currentSegment && currentSegment.type === 'dialogue') {
                const segmentId = `${mesId}_${state.currentIndex}`;
                TTSManager.speak(currentSegment, segmentId);
              }
            }
          } else {
            clearInterval(timer);
            $btn.data('auto-timer', null);
            $btn.html('<i class="fa-solid fa-play"></i> AUTO');
            $btn.removeClass('gal-auto-playing');
            // ★ TTS: 播放结束时停止
            TTSManager.stop();
          }
        }, settings.autoPlaySpeed * 1000);
        $btn.data('auto-timer', timer);
      }
    });
    // 点击立绘占位符上传
    $(doc).on('click', '#gal-global-overlay .gal-char-placeholder', function (e) {
      e.stopPropagation();
      // 从父元素 .gal-char-container 获取角色名称
      const $container = $(this).closest('.gal-char-container');
      const character = $container.data('character') || 'default';
      const expression = $container.data('expression') || '默认';
      showSpriteUploadDialog(character, expression);
    });
    // 双击立绘修改
    $(doc).on('dblclick', '#gal-global-overlay .gal-char-img', function (e) {
      e.stopPropagation();
      // 从父元素 .gal-char-container 获取角色名称和表情
      const $container = $(this).closest('.gal-char-container');
      const character = $container.data('character') || 'default';
      const expression = $container.data('expression') || '默认';
      showSpriteUploadDialog(character, expression);
    });
  }
  /**
   * 更新覆盖层的段落显示
   */
  function updateOverlaySegmentDisplay(state) {
    return __awaiter(this, void 0, void 0, function* () {
      var _a, _b;
      const $overlay = $('#gal-global-overlay');
      const currentIndex = state.currentIndex;
      const segment = state.segments[currentIndex];
      if (!segment) return;
      const speaker = segment.speaker;
      const isNarration = segment.type === 'narration';
      // 更新名字和样式
      const $nameBadge = $overlay.find('.gal-name-badge');
      $nameBadge.find('span').text(speaker || '旁白');
      if (isNarration) {
        $nameBadge.addClass('gal-narrator-label');
      } else {
        $nameBadge.removeClass('gal-narrator-label');
      }
      // 更新文本和进度
      $overlay.find('.gal-dialog-text').text(segment.text || '');
      // 进度条展示进度
      const total = state.segments.length;
      const progressPercent = total > 0 ? ((currentIndex + 1) / total) * 100 : 0;
      $overlay.find('.gal-progress-bar').css('width', `${progressPercent}%`);
      // 更新NEXT按钮
      // 只有当完全是最后一段时才显示END
      const isEnd = currentIndex >= total - 1;
      const $nextBtn = $overlay.find('[data-action="next"]');
      if (isEnd) {
        $nextBtn.html('END <i class="fa-solid fa-check"></i>');
        // ★ 自动弹出选项：如果是最后一段，且有待选选项
        if (pendingOptions && pendingOptions.length > 0 && !galgameChoicesVisible) {
          console.log(`[${SCRIPT_NAME}] 已翻页到末尾，自动弹出选项面板`);
          renderGalgameChoices(pendingOptions);
        }
      } else {
        $nextBtn.html('NEXT <i class="fa-solid fa-chevron-right"></i>');
      }
      // 使用 SpriteManager 更新立绘（支持多角色、动画、情绪）
      const expression = segment.expression || '默认';
      yield SpriteManager.updateSprite($overlay, speaker, expression);
      // 应用场景色调和背景（如果有背景信息）
      if (
        (_b = (_a = state.parsedContent) === null || _a === void 0 ? void 0 : _a.currentBackground) === null ||
        _b === void 0
          ? void 0
          : _b.scene
      ) {
        yield SpriteManager.applySceneTint($overlay, state.parsedContent.currentBackground.scene);
      }
    });
  }
  // 保留旧的updateSegmentDisplay函数用于兼容，但调用新的覆盖层更新函数
  function updateSegmentDisplay($container, state) {
    return __awaiter(this, void 0, void 0, function* () {
      yield updateOverlaySegmentDisplay(state);
    });
  }
  // ============================================
  // 交互功能
  // ============================================
  function showFreeInputModal() {
    const modalHtml = `
      <div class="gal-input-modal" id="gal-free-input-modal">
        <div class="gal-input-box">
          <div class="gal-input-title"><span>自由输入</span></div>
          <textarea class="gal-input-field" id="gal-free-input-text" placeholder="输入你想说的话..."></textarea>
          <div class="gal-input-actions">
            <button class="gal-action-btn" id="gal-input-cancel">
              <span>取消</span>
            </button>
            <button class="gal-action-btn primary" id="gal-input-send">
              <i class="fa-solid fa-paper-plane"></i>
              <span>发送</span>
            </button>
          </div>
        </div>
      </div>
    `;
    $(topWindow.document.body).append(modalHtml);
    const $modal = $('#gal-free-input-modal');
    const $input = $('#gal-free-input-text');
    makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
    $input.focus();
    $('#gal-input-cancel').on('click', () => $modal.remove());
    $modal.on('click', function (e) {
      if (e.target === this) $modal.remove();
    });
    $('#gal-input-send').on('click', () => {
      const text = $input.val().trim();
      if (text) {
        sendUserMessage(text);
        $modal.remove();
      }
    });
    $input.on('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        $('#gal-input-send').click();
      }
    });
  }
  function sendUserMessage(text) {
    // 使用酒馆的发送功能
    const $sendTextarea = $('#send_textarea');
    const $sendButton = $('#send_but');
    if ($sendTextarea.length && $sendButton.length) {
      $sendTextarea.val(text);
      $sendButton.click();
      showToast('消息已发送');
    } else {
      console.error(`[${SCRIPT_NAME}] 未找到发送按钮`);
    }
  }
  // 重绘锁定标记，防止重绘时误触发选项面板
  let isRerolling = false;
  function triggerReroll() {
    // ★ 设置重绘锁定，防止误触发选项面板 ★
    isRerolling = true;
    // ★ 立即隐藏选项面板 ★
    hideGalgameChoices();
    lastGalgameOptionHash = null;
    currentDisplayMesId = null; // 强制重置显示ID
    // ★ 先清除当前消息的段落状态，这样重新生成后会从第1段开始 ★
    const $lastMes = $('.mes.last_mes');
    if ($lastMes.length) {
      const mesId = $lastMes.attr('mesid');
      if (mesId) {
        messageSegmentState.delete(String(mesId));
        console.log(`[${SCRIPT_NAME}] 已清除消息 ${mesId} 的段落状态，准备重新生成`);
      }
    }
    // 触发重新生成
    const $swipeRight = $('.mes.last_mes .swipe_right');
    if ($swipeRight.length) {
      $swipeRight.click();
      showToast('正在重新生成...');
    } else {
      // 尝试使用 SillyTavern API
      try {
        if (topWindow.SillyTavern && topWindow.SillyTavern.Generate) {
          topWindow.SillyTavern.Generate('swipe');
          showToast('正在重新生成...');
        }
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 重新生成失败:`, e);
        showToast('重新生成失败');
        isRerolling = false; // 失败时解除锁定
      }
    }
    // ★ 延迟解除锁定（等待重绘完成后的 DOM 稳定）★
    setTimeout(() => {
      isRerolling = false;
      console.log(`[${SCRIPT_NAME}] 重绘锁定已解除`);
    }, 3000);
  }
  // 固定的立绘长宽比 2:3
  const SPRITE_ASPECT_RATIO = 2 / 3;
  /**
   * 图片裁剪工具类
   */
  class ImageCropper {
    constructor(aspectRatio = SPRITE_ASPECT_RATIO) {
      this.aspectRatio = aspectRatio;
      this.image = null;
      this.imageLoaded = false;
      this.canvas = null;
      this.ctx = null;
      this.scale = 1;
      this.minScale = 0.1;
      this.maxScale = 3;
      this.offsetX = 0;
      this.offsetY = 0;
      this.isDragging = false;
      this.lastX = 0;
      this.lastY = 0;
      this.cropWidth = 0;
      this.cropHeight = 0;
    }
    loadImage(source) {
      return new Promise((resolve, reject) => {
        this.image = new Image();
        this.image.onload = () => {
          this.imageLoaded = true;
          console.log(`[Galgame界面插件] 图片加载完成: ${this.image.width}x${this.image.height}`);
          // 如果已经绑定了 canvas，立即计算并渲染
          if (this.canvas) {
            this.calculateInitialScale();
            this.render();
          }
          resolve(this.image);
        };
        this.image.onerror = e => {
          console.error('[Galgame界面插件] 图片加载失败:', e);
          reject(e);
        };
        if (source instanceof File) {
          const reader = new FileReader();
          reader.onload = e => {
            this.image.src = e.target.result;
          };
          reader.onerror = reject;
          reader.readAsDataURL(source);
        } else if (typeof source === 'string') {
          this.image.src = source;
        }
      });
    }
    calculateInitialScale() {
      if (!this.canvas || !this.image || !this.imageLoaded) {
        console.log('[Galgame界面插件] calculateInitialScale: 条件不满足', {
          canvas: !!this.canvas,
          image: !!this.image,
          imageLoaded: this.imageLoaded,
        });
        return;
      }
      // ★ 直接使用 canvas 的尺寸，确保有有效值 ★
      const containerWidth = this.canvas.width > 0 ? this.canvas.width : 500;
      const containerHeight = this.canvas.height > 0 ? this.canvas.height : 320;
      console.log(`[Galgame界面插件] 容器尺寸: ${containerWidth}x${containerHeight}`);
      // 计算裁剪框尺寸（基于容器）
      this.cropHeight = containerHeight * 0.8;
      this.cropWidth = this.cropHeight * this.aspectRatio;
      if (this.cropWidth > containerWidth * 0.8) {
        this.cropWidth = containerWidth * 0.8;
        this.cropHeight = this.cropWidth / this.aspectRatio;
      }
      console.log(`[Galgame界面插件] 裁剪框尺寸: ${this.cropWidth}x${this.cropHeight}`);
      // 计算最小缩放：确保图片至少覆盖裁剪区域
      const scaleToFitWidth = this.cropWidth / this.image.width;
      const scaleToFitHeight = this.cropHeight / this.image.height;
      this.minScale = Math.max(scaleToFitWidth, scaleToFitHeight);
      // 初始缩放：让图片刚好覆盖裁剪区域
      this.scale = this.minScale * 1.2;
      this.maxScale = Math.max(this.minScale * 5, 3);
      console.log(
        `[Galgame界面插件] 缩放范围: ${this.minScale.toFixed(3)} - ${this.maxScale.toFixed(3)}, 当前: ${this.scale.toFixed(3)}`,
      );
      // 居中
      this.offsetX = 0;
      this.offsetY = 0;
    }
    attachToCanvas(canvasElement) {
      this.canvas = canvasElement;
      this.ctx = this.canvas.getContext('2d');
      this.setupEventListeners();
      // 如果图片已加载，立即计算并渲染
      if (this.imageLoaded) {
        this.calculateInitialScale();
        this.render();
      }
    }
    setupEventListeners() {
      const wrapper = this.canvas.parentElement;
      wrapper.addEventListener('mousedown', e => {
        this.isDragging = true;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        wrapper.style.cursor = 'grabbing';
      });
      wrapper.addEventListener('mousemove', e => {
        if (!this.isDragging) return;
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.constrainOffset();
        this.render();
      });
      wrapper.addEventListener('mouseup', () => {
        this.isDragging = false;
        wrapper.style.cursor = 'move';
      });
      wrapper.addEventListener('mouseleave', () => {
        this.isDragging = false;
        wrapper.style.cursor = 'move';
      });
      // 触摸支持
      wrapper.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
          this.isDragging = true;
          this.lastX = e.touches[0].clientX;
          this.lastY = e.touches[0].clientY;
        }
      });
      wrapper.addEventListener('touchmove', e => {
        if (!this.isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - this.lastX;
        const dy = e.touches[0].clientY - this.lastY;
        this.offsetX += dx;
        this.offsetY += dy;
        this.lastX = e.touches[0].clientX;
        this.lastY = e.touches[0].clientY;
        this.constrainOffset();
        this.render();
      });
      wrapper.addEventListener('touchend', () => {
        this.isDragging = false;
      });
    }
    setScale(newScale) {
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, newScale));
      this.constrainOffset();
      this.render();
    }
    constrainOffset() {
      if (!this.image) return;
      const scaledWidth = this.image.width * this.scale;
      const scaledHeight = this.image.height * this.scale;
      // 限制偏移，确保图片始终覆盖裁剪区域
      const maxOffsetX = (scaledWidth - this.cropWidth) / 2;
      const maxOffsetY = (scaledHeight - this.cropHeight) / 2;
      this.offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, this.offsetX));
      this.offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, this.offsetY));
    }
    reset() {
      this.calculateInitialScale();
      this.render();
    }
    render() {
      if (!this.ctx || !this.image || !this.imageLoaded) {
        console.log('[Galgame界面插件] render: 条件不满足', {
          ctx: !!this.ctx,
          image: !!this.image,
          imageLoaded: this.imageLoaded,
        });
        return;
      }
      // ★ 直接使用 canvas 的尺寸，不依赖 wrapper ★
      const containerWidth = this.canvas.width || 500;
      const containerHeight = this.canvas.height || 320;
      console.log('[Galgame界面插件] render: 使用尺寸', containerWidth, 'x', containerHeight);
      // 确保裁剪框尺寸已计算
      if (this.cropWidth === 0 || this.cropHeight === 0) {
        this.calculateInitialScale();
      }
      // 清空画布
      this.ctx.fillStyle = '#1a1a2e';
      this.ctx.fillRect(0, 0, containerWidth, containerHeight);
      // 绘制图片
      const scaledWidth = this.image.width * this.scale;
      const scaledHeight = this.image.height * this.scale;
      const drawX = (containerWidth - scaledWidth) / 2 + this.offsetX;
      const drawY = (containerHeight - scaledHeight) / 2 + this.offsetY;
      this.ctx.drawImage(this.image, drawX, drawY, scaledWidth, scaledHeight);
      // 绘制裁剪框遮罩
      const cropX = (containerWidth - this.cropWidth) / 2;
      const cropY = (containerHeight - this.cropHeight) / 2;
      // 半透明遮罩
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      // 上
      this.ctx.fillRect(0, 0, containerWidth, cropY);
      // 下
      this.ctx.fillRect(0, cropY + this.cropHeight, containerWidth, containerHeight - cropY - this.cropHeight);
      // 左
      this.ctx.fillRect(0, cropY, cropX, this.cropHeight);
      // 右
      this.ctx.fillRect(cropX + this.cropWidth, cropY, containerWidth - cropX - this.cropWidth, this.cropHeight);
      // 裁剪框边框
      this.ctx.strokeStyle = '#00d2ff';
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(cropX, cropY, this.cropWidth, this.cropHeight);
      // 角落标记
      const cornerSize = 15;
      this.ctx.lineWidth = 4;
      // 左上
      this.ctx.beginPath();
      this.ctx.moveTo(cropX, cropY + cornerSize);
      this.ctx.lineTo(cropX, cropY);
      this.ctx.lineTo(cropX + cornerSize, cropY);
      this.ctx.stroke();
      // 右上
      this.ctx.beginPath();
      this.ctx.moveTo(cropX + this.cropWidth - cornerSize, cropY);
      this.ctx.lineTo(cropX + this.cropWidth, cropY);
      this.ctx.lineTo(cropX + this.cropWidth, cropY + cornerSize);
      this.ctx.stroke();
      // 左下
      this.ctx.beginPath();
      this.ctx.moveTo(cropX, cropY + this.cropHeight - cornerSize);
      this.ctx.lineTo(cropX, cropY + this.cropHeight);
      this.ctx.lineTo(cropX + cornerSize, cropY + this.cropHeight);
      this.ctx.stroke();
      // 右下
      this.ctx.beginPath();
      this.ctx.moveTo(cropX + this.cropWidth - cornerSize, cropY + this.cropHeight);
      this.ctx.lineTo(cropX + this.cropWidth, cropY + this.cropHeight);
      this.ctx.lineTo(cropX + this.cropWidth, cropY + this.cropHeight - cornerSize);
      this.ctx.stroke();
    }
    getCroppedBlob(outputWidth = 400) {
      return new Promise(resolve => {
        const outputHeight = outputWidth / this.aspectRatio;
        const outputCanvas = document.createElement('canvas');
        outputCanvas.width = outputWidth;
        outputCanvas.height = outputHeight;
        const outputCtx = outputCanvas.getContext('2d');
        // ★ 直接使用 canvas 的尺寸 ★
        const containerWidth = this.canvas.width || 500;
        const containerHeight = this.canvas.height || 320;
        const scaledWidth = this.image.width * this.scale;
        const scaledHeight = this.image.height * this.scale;
        const drawX = (containerWidth - scaledWidth) / 2 + this.offsetX;
        const drawY = (containerHeight - scaledHeight) / 2 + this.offsetY;
        const cropX = (containerWidth - this.cropWidth) / 2;
        const cropY = (containerHeight - this.cropHeight) / 2;
        // 计算源图片裁剪区域
        const srcX = (cropX - drawX) / this.scale;
        const srcY = (cropY - drawY) / this.scale;
        const srcWidth = this.cropWidth / this.scale;
        const srcHeight = this.cropHeight / this.scale;
        outputCtx.drawImage(this.image, srcX, srcY, srcWidth, srcHeight, 0, 0, outputWidth, outputHeight);
        outputCanvas.toBlob(blob => resolve(blob), 'image/png', 1);
      });
    }
  }

  /**
   * 角色外貌提示词编辑弹窗
   * @param {string} characterId - 角色ID
   * @param {Function} onSave - 保存后回调
   */
  function showCharAppearancePromptEditor(characterId, onSave) {
    const currentPrompt = getCharAppearancePrompt(characterId);

    const modalHtml = `
            <div class="gal-input-modal" id="gal-appearance-prompt-modal">
                <div class="gal-input-box" style="max-width: 550px; width: 90%; padding: 25px;">
                    <div class="gal-input-title" style="margin-bottom: 20px;">
                        <span><i class="fa-solid fa-palette"></i> ${characterId} 的外貌提示词</span>
                    </div>

                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            角色外观描述 (用于AI绘图)
                        </label>
                        <textarea id="gal-appearance-prompt-input"
                                  placeholder="例如: 1girl, long white hair, blue eyes, school uniform, slender figure..."
                                  style="width: 100%; height: 150px; padding: 12px; border: 2px solid #ddd; border-radius: 6px; font-size: 0.95rem; resize: vertical; box-sizing: border-box;">${currentPrompt}</textarea>
                        <small style="color: #888; margin-top: 5px; display: block;">
                            此提示词将作为文生图时的基础外观描述，放在最终提示词的最前面。
                        </small>
                    </div>

                    <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 15px;">
                        <div style="font-weight: 600; margin-bottom: 8px; color: ${THEME.dark};">
                            <i class="fa-solid fa-lightbulb"></i> 提示词建议
                        </div>
                        <div style="font-size: 0.85rem; color: #666; line-height: 1.6;">
                            • 性别/人数: 1girl, 1boy, solo<br>
                            • 发型发色: long hair, short hair, black hair, blonde<br>
                            • 眼睛: blue eyes, red eyes, heterochromia<br>
                            • 服装: school uniform, dress, casual clothes<br>
                            • 体型: slender, petite, tall, muscular
                        </div>
                    </div>

                    <div class="gal-input-actions" style="display: flex; gap: 12px;">
                        <button class="gal-action-btn" id="gal-appearance-cancel" style="flex: 1; min-height: 44px;">
                            <span>取消</span>
                        </button>
                        <button class="gal-action-btn primary" id="gal-appearance-save" style="flex: 1; min-height: 44px;">
                            <i class="fa-solid fa-save"></i>
                            <span>保存</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

    $(topWindow.document.body).append(modalHtml);
    const $modal = $('#gal-appearance-prompt-modal');
    makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));

    $('#gal-appearance-cancel').on('click', () => $modal.remove());
    $modal.on('click', function (e) {
      if (e.target === this) $modal.remove();
    });

    $('#gal-appearance-save').on('click', function () {
      const newPrompt = $('#gal-appearance-prompt-input').val().trim();
      setCharAppearancePrompt(characterId, newPrompt);
      showToast(`已保存 ${characterId} 的外貌提示词`);
      $modal.remove();
      if (typeof onSave === 'function') onSave(newPrompt);
    });
  }

  // 立绘上传对话框（带裁剪功能）
  function showSpriteUploadDialog(characterId, expression, onCloseCallback) {
    // 动态获取表情列表（预设 + 自定义）
    const allExpressions = getAllExpressions();
    const expressionOptions = allExpressions
      .map(
        e =>
          `<option value="${e}" ${e === expression || (expression === 'neutral' && e === '默认') ? 'selected' : ''}>${e}</option>`,
      )
      .join('');
    const modalHtml = `
      <div class="gal-input-modal" id="gal-sprite-upload-modal">
        <div class="gal-input-box" style="max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; padding: 25px;">
          <div class="gal-input-title" style="margin-bottom: 15px; font-size: 1.4rem;"><span>上传角色立绘</span></div>

          <div style="margin-bottom: 15px; display: flex; gap: 15px;">
            <div style="flex: 1;">
              <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark}; font-size: 1rem;">
                <i class="fa-solid fa-user"></i> 角色名称
              </label>
              <input type="text" id="gal-sprite-character" value="${characterId || ''}"
                     placeholder="输入角色名"
                     style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 4px;">
            </div>
            <div style="flex: 1;">
              <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark}; font-size: 1rem;">
                <i class="fa-solid fa-face-smile"></i> 表情类型
              </label>
              <select id="gal-sprite-expression"
                      style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; cursor: pointer; box-sizing: border-box; border-radius: 4px;">
                ${expressionOptions}
              </select>
            </div>
          </div>

          <!-- TTS音色选择 -->
          <div style="margin-bottom: 15px; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); padding: 15px; border-radius: 8px; border: 1px solid #ddd;">
            <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark}; font-size: 1rem;">
              <i class="fa-solid fa-microphone-lines"></i> TTS配音音色
              <small style="font-weight: normal; color: #666; margin-left: 8px;">为该角色绑定专属配音音色</small>
            </label>
            <div style="display: flex; gap: 10px;">
              <select id="gal-tts-voice-select"
                      style="flex: 1; padding: 10px 15px; border: 2px solid #ddd; font-size: 1rem; cursor: pointer; border-radius: 4px; background: #fff;">
                <option value="">-- 不绑定音色 --</option>
                ${TTS_VOICE_LIST.map(v => `<option value="${v.name}" ${getCharacterTTSVoice(characterId) === v.name ? 'selected' : ''}>${v.name} (${v.desc})</option>`).join('')}
              </select>
              <button class="gal-action-btn" id="gal-tts-voice-save-btn" style="white-space: nowrap; padding: 10px 20px;">
                <i class="fa-solid fa-check"></i> 绑定
              </button>
            </div>
            <small style="color: #888; margin-top: 6px; display: block;">
              <i class="fa-solid fa-circle-info"></i> 绑定后AI会自动为该角色使用此音色配音
            </small>
          </div>

          <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
            <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
            <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
            <div class="gal-upload-tab" data-target="comfyui" style="padding: 8px 15px; cursor: pointer; color: #888;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> 本地文生图
            </div>
          </div>

          <div id="gal-upload-local" class="gal-upload-pane">
            <input type="file" id="gal-sprite-file" accept="image/*" style="display: none;">
            <!-- 未选择图片时显示上传区 -->
            <div class="gal-upload-card" id="gal-upload-trigger" style="margin-bottom: 15px; min-height: 200px;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 3.5rem;"></i>
              <span style="font-size: 1.2rem; margin-top: 10px;">点击选择立绘图片</span>
              <small style="color: #999; margin-top: 8px; font-size: 0.9rem;">支持 PNG / JPG / GIF / WebP</small>
              <small style="color: ${THEME.accent}; margin-top: 4px; font-size: 0.9rem;">立绘将自动裁剪为 2:3 比例</small>
            </div>
          </div>

          <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc; text-align: center; min-height: 160px; display: flex; flex-direction: column; justify-content: center;">
              <div style="margin-bottom: 15px;">
                <input type="text" id="gal-sprite-remote-url" placeholder="输入图片 URL (https://...)"
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
              </div>
              <button class="gal-action-btn" id="gal-sprite-fetch-btn" style="width: 100%;">
                <i class="fa-solid fa-download"></i> 获取图片
              </button>
            </div>
          </div>

          <div id="gal-upload-comfyui" class="gal-upload-pane" style="display: none;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; color: #fff; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 1.5rem;"></i>
                        <span style="font-weight: 700; font-size: 1.1rem;">ComfyUI 文生图</span>
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">
                        使用本地ComfyUI自动生成角色立绘
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px;">工作流</label>
                        <select id="gal-comfy-wf-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></select>
                    </div>
                    <div style="flex: 1;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px;">Checkpoint 模型</label>
                        <select id="gal-comfy-checkpoint-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                             <option value="">(加载中...)</option>
                        </select>
                    </div>
                </div>

                <!-- 外貌提示词预览/编辑 -->
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="font-weight: 700; color: ${THEME.dark};">
                            <i class="fa-solid fa-user"></i> 角色外貌基础提示词
                        </label>
                        <button class="gal-action-btn" id="gal-edit-appearance-btn" style="padding: 4px 10px; font-size: 0.8rem;">
                            <i class="fa-solid fa-pen"></i> 编辑
                        </button>
                    </div>
                    <div id="gal-appearance-preview" style="background: #f5f5f5; padding: 10px; border-radius: 6px; font-size: 0.85rem; color: #666; min-height: 40px; border: 1px dashed #ddd;">
                        ${getCharAppearancePrompt(characterId) || '<i style="color: #999;">未设置，点击右侧按钮添加</i>'}
                    </div>
                </div>

                <!-- 当前表情预览 -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-face-smile"></i> 当前表情: <span id="gal-comfyui-expr-label" style="color: ${THEME.accent};">${expression}</span>
                    </label>
                    <div style="background: #e8f4fc; padding: 8px 12px; border-radius: 6px; font-size: 0.85rem; color: #0066cc;">
                        <i class="fa-solid fa-arrow-right"></i>
                        将生成: <code id="gal-comfyui-expr-tag">${getExpressionTag(expression)}</code>
                    </div>
                </div>

                <!-- 额外描述 -->
                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-plus"></i> 额外描述 (可选)
                    </label>
                    <textarea id="gal-comfyui-extra-prompt"
                              placeholder="添加额外的场景、姿势、光照描述..."
                              style="width: 100%; height: 60px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; resize: vertical; box-sizing: border-box;"></textarea>
                </div>

                <!-- 生成按钮 -->
                <button class="gal-action-btn primary" id="gal-comfyui-generate-btn" style="width: 100%; min-height: 50px; justify-content: center; font-size: 1.1rem;">
                    <i class="fa-solid fa-sparkles"></i>
                    <span>生成立绘</span>
                </button>

                <!-- 生成结果预览区 -->
                <div id="gal-comfyui-result" style="display: none; margin-top: 15px;">
                    <div style="text-align: center;">
                        <img id="gal-comfyui-preview-img" style="max-width: 100%; max-height: 300px; border-radius: 8px; border: 2px solid ${THEME.accent};">
                    </div>
                </div>
          </div>

          <!-- 选择图片后显示裁剪区 -->
          <div id="gal-crop-area" style="display: none;">
            <div class="gal-crop-container">
              <div class="gal-crop-canvas-wrapper" id="gal-crop-wrapper">
                <canvas id="gal-crop-canvas"></canvas>
              </div>
              <div class="gal-crop-controls">
                <button class="gal-crop-btn reset" id="gal-crop-reset" title="重置位置">
                  <i class="fa-solid fa-undo"></i> 重置
                </button>
                <input type="range" id="gal-crop-zoom" class="gal-crop-zoom-slider" min="10" max="300" value="100" style="width: 180px;">
                <span class="gal-crop-zoom-label" id="gal-zoom-value" style="min-width: 50px; font-size: 0.95rem;">100%</span>
                <button class="gal-crop-btn" id="gal-change-image" style="background: ${THEME.accent}; color: ${THEME.dark};" title="更换图片">
                  <i class="fa-solid fa-image"></i> 换图
                </button>
              </div>
            </div>
            <p style="text-align: center; color: #666; font-size: 0.85rem; margin: 8px 0 12px 0;">
              <i class="fa-solid fa-hand-pointer"></i> 拖动图片调整位置，滑块调整缩放
            </p>
          </div>

          <div class="gal-input-actions" style="display: flex; gap: 15px; margin-top: 15px;">
            <button class="gal-action-btn" id="gal-upload-cancel" style="flex: 1; min-height: 48px; padding: 12px 16px; font-size: 1rem;">
              <span>取消</span>
            </button>
            <button class="gal-action-btn" id="gal-batch-upload-btn" style="flex: 1; background: #666; color: #fff; min-height: 48px; padding: 12px 16px; font-size: 1rem;">
              <i class="fa-solid fa-images"></i>
              <span>批量上传</span>
            </button>
            <button class="gal-action-btn primary" id="gal-upload-confirm" style="flex: 1; min-height: 48px; padding: 12px 16px; font-size: 1rem;" disabled>
              <i class="fa-solid fa-check"></i>
              <span>保存立绘</span>
            </button>
          </div>
        </div>
      </div>
    `;
    $(topWindow.document.body).append(modalHtml);
    const $modal = $('#gal-sprite-upload-modal');
    makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
    const $fileInput = $('#gal-sprite-file');
    const $confirmBtn = $('#gal-upload-confirm');
    const $uploadTrigger = $('#gal-upload-trigger');
    const $cropArea = $('#gal-crop-area');
    const $zoomSlider = $('#gal-crop-zoom');
    const $zoomValue = $('#gal-zoom-value');
    let cropper = null;

    // 点击上传区域
    $uploadTrigger.on('click', () => $fileInput.click());

    // 更换图片
    $('#gal-change-image').on('click', () => $fileInput.click());

    // 统一关闭处理
    const handleClose = () => {
      $modal.remove();
      if (typeof onCloseCallback === 'function') {
        try {
          onCloseCallback();
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
        }
      }
    };
    // 取消
    $('#gal-upload-cancel').on('click', handleClose);
    // TTS音色绑定按钮
    $('#gal-tts-voice-save-btn').on('click', () => {
      const charName = $('#gal-sprite-character').val().trim() || characterId;
      const voiceName = $('#gal-tts-voice-select').val();
      if (!charName) {
        showToast('请先输入角色名称');
        return;
      }
      setCharacterTTSVoice(charName, voiceName);
      if (voiceName) {
        showToast(`已绑定: ${charName} → ${voiceName}`);
      } else {
        showToast(`已清除 ${charName} 的音色绑定`);
      }
    });
    // 角色名称变化时更新音色选择
    $('#gal-sprite-character').on('input', function () {
      const newCharName = $(this).val().trim();
      if (newCharName) {
        const boundVoice = getCharacterTTSVoice(newCharName);
        $('#gal-tts-voice-select').val(boundVoice || '');
      }
    });
    // 批量上传按钮
    $('#gal-batch-upload-btn').on('click', () => {
      const charName = $('#gal-sprite-character').val().trim();
      $modal.remove();
      showBatchUploadDialog(charName || characterId, onCloseCallback);
    });
    // Tab 切换
    $modal.find('.gal-upload-tab').on('click', function () {
      const target = $(this).data('target');
      $modal
        .find('.gal-upload-tab')
        .removeClass('active')
        .css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
      $(this)
        .addClass('active')
        .css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
      $modal.find('.gal-upload-pane').hide();
      $modal.find(`#gal-upload-${target}`).show();
    });
    // 远程图片获取
    $('#gal-sprite-fetch-btn').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        const url = $('#gal-sprite-remote-url').val().trim();
        if (!url) return showToast('请输入图片链接');
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 获取中...');
        try {
          const response = yield fetch(url);
          if (!response.ok) throw new Error('网络请求失败');
          const blob = yield response.blob();
          if (!blob.type.startsWith('image/')) throw new Error('链接不是有效的图片');
          // 模拟文件选择
          const file = new File([blob], 'remote_image.png', { type: blob.type });
          // 触发处理逻辑 (复用 existing logic)
          // 我们需要手动调用处理函数，因为 programmatic FileList 赋值给 input 比较麻烦
          handleFileSelect(file);
        } catch (e) {
          showToast('获取失败: ' + e.message);
        } finally {
          $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 获取图片');
        }
      });
    });

    // ===================================
    // ComfyUI 事件绑定
    // ===================================

    // 填充模型下拉框
    async function initComfyUICheckpointSelect() {
      const $sel = $('#gal-comfy-checkpoint-select');
      const cs = getComfyUISettings();

      try {
        const models = await ComfyUIAPI.getModels(cs.apiUrl);
        $sel.empty();
        $sel.append('<option value="">-- 使用 Workflow默认 --</option>');

        models.forEach(m => {
          $sel.append(`<option value="${m}">${m}</option>`);
        });

        if (cs.defaultCheckpoint) {
          $sel.val(cs.defaultCheckpoint);
        }
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 加载模型失败:`, e);
        $sel.html('<option value="">(加载失败)</option>');
      }
    }
    initComfyUICheckpointSelect();

    // 填充工作流下拉框
    function initComfyUIWorkflowSelect() {
      const $sel = $('#gal-comfy-wf-select');
      const workflows = getComfyWorkflows();
      const cs = getComfyUISettings();

      $sel.empty();
      $sel.append('<option value="default_char">内置 SDXL Turbo</option>');

      Object.keys(workflows).forEach(id => {
        $sel.append(`<option value="${id}">${workflows[id].name}</option>`);
      });

      if (cs.defaultCharWorkflow) {
        $sel.val(cs.defaultCharWorkflow);
      }
    }
    initComfyUIWorkflowSelect();

    // 编辑外貌提示词按钮
    $('#gal-edit-appearance-btn').on('click', () => {
      const charName = $('#gal-sprite-character').val().trim() || characterId;
      showCharAppearancePromptEditor(charName, newPrompt => {
        // 更新预览
        $('#gal-appearance-preview').html(newPrompt || '<i style="color: #999;">未设置，点击右侧按钮添加</i>');
      });
    });

    // 表情选择变化时更新文生图Tab中的显示
    $('#gal-sprite-expression').on('change', function () {
      const expr = $(this).val();
      $('#gal-comfyui-expr-label').text(expr);
      $('#gal-comfyui-expr-tag').text(getExpressionTag(expr));
    });

    // ComfyUI 生成按钮
    $('#gal-comfyui-generate-btn').on('click', async function () {
      const charName = $('#gal-sprite-character').val().trim();
      const expr = $('#gal-sprite-expression').val();
      const extraPrompt = $('#gal-comfyui-extra-prompt').val().trim();
      const wfId = $('#gal-comfy-wf-select').val();
      const checkpointOverride = $('#gal-comfy-checkpoint-select').val(); // 获取选择的模型

      if (!charName) {
        showToast('请先输入角色名称');
        return;
      }

      // 检查是否有外貌提示词
      const appearancePrompt = getCharAppearancePrompt(charName);
      if (!appearancePrompt) {
        if (
          !confirm(
            '尚未设置角色外貌提示词，生成的图片可能不符合角色特征。\n是否继续生成？\n（建议先点击"编辑"按钮设置外貌描述）',
          )
        ) {
          return;
        }
      }

      $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 生成中...');
      $('#gal-comfyui-result').hide();

      // 准备提示词
      const positive = [appearancePrompt, getExpressionTag(expr), extraPrompt, 'masterpiece, best quality, highres']
        .filter(p => p && p.trim())
        .join(', ');

      const cs = getComfyUISettings();
      const negative = cs.negativePrompt || DEFAULT_COMFYUI_SETTINGS.negativePrompt;

      // 准备 Workflow
      let workflow;
      if (wfId === 'default_char' || !wfId) {
        workflow = ComfyUIAPI.buildDefaultWorkflow(positive, negative, 512, 768, 20, 7);
      } else {
        const workflows = getComfyWorkflows();
        const stored = workflows[wfId];
        if (stored) {
          workflow = stored.json; // 使用存储的 workflow
        } else {
          workflow = ComfyUIAPI.buildDefaultWorkflow(positive, negative, 512, 768, 20, 7);
        }
      }

      try {
        // 如果是自定义Workflow，传入纯提示词，由 API 内部处理注入
        // 但 API.generate 需要的是 workflowJson 和 promptText 用于注入
        // 这里逻辑稍微调整：如果用了自定义Workflow，我们传 undefined 或特殊的标识给 buildDefaultWorkflow，
        // 或者 API.generate 直接接收 workflow 对象。
        // 现在的 ComfyUIAPI.generate 接收 (workflowJson, promptText, negativeText, extraSettings)

        const blob = await ComfyUIAPI.generate(workflow, positive, negative, { checkpointOverride });

        // 转换为 File 对象，复用 handleFileSelect 逻辑进入裁剪界面
        const fileName = `comfyui_gen_${Date.now()}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // 调用文件处理逻辑 (进入裁剪)
        handleFileSelect(file);

        showToast('立绘生成成功！请在上方裁剪区域调整后保存');
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] ComfyUI生成失败:`, e);
        showToast('生成失败: ' + e.message);
      } finally {
        $(this).prop('disabled', false).html('<i class="fa-solid fa-sparkles"></i><span>生成立绘</span>');
      }
    });
    $modal.on('click', function (e) {
      if (e.target === this) {
        handleClose();
      }
    });
    // 封装文件处理逻辑
    function handleFileSelect(file) {
      return __awaiter(this, void 0, void 0, function* () {
        if (!file) return;
        console.log('[Galgame界面插件] 开始处理图片:', file.name, file.type, file.size);
        // 先隐藏上传区，显示裁剪区
        $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
        $cropArea.show();
        $confirmBtn.prop('disabled', false);
        // 获取 canvas
        const canvas = topWindow.document.getElementById('gal-crop-canvas');
        if (!canvas) {
          console.error('[Galgame界面插件] 未找到裁剪 canvas');
          showToast('裁剪区域初始化失败');
          return;
        }
        // ★★★ 关键修复：使用固定尺寸，不依赖 DOM 计算 ★★★
        const CANVAS_WIDTH = 640;
        const CANVAS_HEIGHT = 380;
        // 设置 canvas 像素尺寸
        canvas.width = CANVAS_WIDTH;
        canvas.height = CANVAS_HEIGHT;
        console.log('[Galgame界面插件] Canvas 尺寸已设置:', CANVAS_WIDTH, 'x', CANVAS_HEIGHT);
        // ★★★ 先加载图片，再创建裁剪器 ★★★
        const img = new Image();
        const imageLoadPromise = new Promise((resolve, reject) => {
          img.onload = () => {
            console.log('[Galgame界面插件] 图片已加载，原始尺寸:', img.width, 'x', img.height);
            resolve(img);
          };
          img.onerror = e => {
            console.error('[Galgame界面插件] 图片加载错误:', e);
            reject(e);
          };
        });
        // 读取文件为 DataURL
        const reader = new FileReader();
        reader.onload = e => {
          img.src = e.target.result;
        };
        reader.onerror = e => {
          console.error('[Galgame界面插件] 文件读取错误:', e);
          showToast('文件读取失败');
        };
        reader.readAsDataURL(file);
        // 等待图片加载
        try {
          yield imageLoadPromise;
        } catch (e) {
          showToast('图片加载失败，请重试');
          return;
        }
        // ★★★ 直接在 canvas 上绘制，不使用复杂的裁剪器类 ★★★
        const ctx = canvas.getContext('2d');
        // 计算裁剪框尺寸 (2:3 比例)
        const cropHeight = CANVAS_HEIGHT * 0.85;
        const cropWidth = cropHeight * SPRITE_ASPECT_RATIO;
        const cropX = (CANVAS_WIDTH - cropWidth) / 2;
        const cropY = (CANVAS_HEIGHT - cropHeight) / 2;
        // 计算图片初始缩放（确保覆盖裁剪区域）
        const scaleToFitWidth = cropWidth / img.width;
        const scaleToFitHeight = cropHeight / img.height;
        let scale = Math.max(scaleToFitWidth, scaleToFitHeight) * 1.1;
        let offsetX = 0;
        let offsetY = 0;
        // 渲染函数
        function renderCrop() {
          // 清空
          ctx.fillStyle = '#1a1a2e';
          ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
          // 绘制图片
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const drawX = (CANVAS_WIDTH - scaledWidth) / 2 + offsetX;
          const drawY = (CANVAS_HEIGHT - scaledHeight) / 2 + offsetY;
          ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);
          // 绘制遮罩
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(0, 0, CANVAS_WIDTH, cropY); // 上
          ctx.fillRect(0, cropY + cropHeight, CANVAS_WIDTH, CANVAS_HEIGHT - cropY - cropHeight); // 下
          ctx.fillRect(0, cropY, cropX, cropHeight); // 左
          ctx.fillRect(cropX + cropWidth, cropY, CANVAS_WIDTH - cropX - cropWidth, cropHeight); // 右
          // 绘制裁剪框边框
          ctx.strokeStyle = '#00d2ff';
          ctx.lineWidth = 3;
          ctx.strokeRect(cropX, cropY, cropWidth, cropHeight);
        }
        // 初始渲染
        renderCrop();
        console.log('[Galgame界面插件] 图片已渲染到 canvas');
        // 拖动事件
        let isDragging = false;
        let lastX = 0,
          lastY = 0;
        canvas.onmousedown = e => {
          isDragging = true;
          lastX = e.clientX;
          lastY = e.clientY;
          canvas.style.cursor = 'grabbing';
        };
        canvas.onmousemove = e => {
          if (!isDragging) return;
          const dx = e.clientX - lastX;
          const dy = e.clientY - lastY;
          offsetX += dx;
          offsetY += dy;
          lastX = e.clientX;
          lastY = e.clientY;
          // 限制偏移
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const maxOffsetX = (scaledWidth - cropWidth) / 2;
          const maxOffsetY = (scaledHeight - cropHeight) / 2;
          offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
          offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
          renderCrop();
        };
        canvas.onmouseup = () => {
          isDragging = false;
          canvas.style.cursor = 'move';
        };
        canvas.onmouseleave = () => {
          isDragging = false;
          canvas.style.cursor = 'move';
        };
        // 缩放滑块
        const minScale = Math.max(scaleToFitWidth, scaleToFitHeight);
        const maxScale = minScale * 5;
        $zoomSlider.attr('min', Math.round(minScale * 100));
        $zoomSlider.attr('max', Math.round(maxScale * 100));
        $zoomSlider.val(Math.round(scale * 100));
        $zoomValue.text(Math.round(scale * 100) + '%');
        $zoomSlider.off('input').on('input', function () {
          scale = parseInt($(this).val()) / 100;
          scale = Math.max(minScale, Math.min(maxScale, scale));
          $zoomValue.text(Math.round(scale * 100) + '%');
          // 限制偏移
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          const maxOffsetX = (scaledWidth - cropWidth) / 2;
          const maxOffsetY = (scaledHeight - cropHeight) / 2;
          offsetX = Math.max(-maxOffsetX, Math.min(maxOffsetX, offsetX));
          offsetY = Math.max(-maxOffsetY, Math.min(maxOffsetY, offsetY));
          renderCrop();
        });
        // 重置按钮
        $('#gal-crop-reset')
          .off('click')
          .on('click', () => {
            scale = Math.max(scaleToFitWidth, scaleToFitHeight) * 1.1;
            offsetX = 0;
            offsetY = 0;
            $zoomSlider.val(Math.round(scale * 100));
            $zoomValue.text(Math.round(scale * 100) + '%');
            renderCrop();
          });
        // 保存裁剪器状态供确认按钮使用
        cropper = {
          getCroppedBlob: (outputWidth = 400) => {
            return new Promise(resolve => {
              const outputHeight = outputWidth / SPRITE_ASPECT_RATIO;
              const outputCanvas = document.createElement('canvas');
              outputCanvas.width = outputWidth;
              outputCanvas.height = outputHeight;
              const outputCtx = outputCanvas.getContext('2d');
              const scaledWidth = img.width * scale;
              const scaledHeight = img.height * scale;
              const drawX = (CANVAS_WIDTH - scaledWidth) / 2 + offsetX;
              const drawY = (CANVAS_HEIGHT - scaledHeight) / 2 + offsetY;
              // 计算源图片裁剪区域
              const srcX = (cropX - drawX) / scale;
              const srcY = (cropY - drawY) / scale;
              const srcWidth = cropWidth / scale;
              const srcHeight = cropHeight / scale;
              outputCtx.drawImage(img, srcX, srcY, srcWidth, srcHeight, 0, 0, outputWidth, outputHeight);
              outputCanvas.toBlob(blob => resolve(blob), 'image/png', 1);
            });
          },
        };
        console.log('[Galgame界面插件] 裁剪器就绪');
      });
    }
    // 文件选择后初始化裁剪器
    $fileInput.on('change', function () {
      const file = this.files[0];
      if (!file) return;
      handleFileSelect(file);
    });
    // 缩放滑块
    $zoomSlider.on('input', function () {
      const scale = parseInt($(this).val()) / 100;
      if (cropper) {
        cropper.setScale(scale);
        $zoomValue.text(Math.round(cropper.scale * 100) + '%');
      }
    });
    // 重置按钮
    $('#gal-crop-reset').on('click', () => {
      if (cropper) {
        cropper.reset();
        $zoomSlider.val(Math.round(cropper.scale * 100));
        $zoomValue.text(Math.round(cropper.scale * 100) + '%');
      }
    });
    // 确认保存
    $confirmBtn.on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        if (!cropper) return;
        const charName = $('#gal-sprite-character').val().trim();
        const expr = $('#gal-sprite-expression').val();
        if (!charName) {
          showToast('请输入角色名称');
          return;
        }
        try {
          $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...');
          const croppedBlob = yield cropper.getCroppedBlob(400);
          yield saveSprite(charName, expr, croppedBlob);
          showToast(`已保存: ${charName} - ${expr}`);
          $modal.remove();
          refreshGalgameViews();
          if (typeof onCloseCallback === 'function') {
            try {
              onCloseCallback();
            } catch (e) {
              console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
            }
          }
        } catch (e) {
          console.error(`[${SCRIPT_NAME}] 保存立绘失败:`, e);
          showToast('保存失败');
          $(this).prop('disabled', false).html('<i class="fa-solid fa-check"></i><span>保存立绘</span>');
        }
      });
    });
  }
  /**
   * 批量上传立绘对话框 - 智能网格切分模式
   * 支持上传一张包含多个表情的大图，自动切分成各个表情立绘
   */
  function showBatchUploadDialog(characterId, onCloseCallback) {
    // 动态获取表情列表（预设 + 自定义）
    const allExpressions = getAllExpressions();
    const modalHtml = `
      <div class="gal-input-modal" id="gal-batch-upload-modal">
        <div class="gal-input-box" style="max-width: 1100px; width: 95%; height: 85vh; padding: 0; display: flex; flex-direction: column; overflow: hidden;">
          <div class="gal-input-title" style="padding: 15px 20px; border-bottom: 1px solid #eee; flex-shrink: 0;">
            <span><i class="fa-solid fa-grid-2"></i> 智能批量上传立绘</span>
          </div>

          <div style="display: flex; flex: 1; overflow: hidden;">
            <!-- Sidebar -->
            <div class="gal-batch-sidebar" style="width: 240px; border-right: 1px solid #ddd; background: #f8f9fa; display: flex; flex-direction: column;">
                <div style="padding: 10px; border-bottom: 1px solid #eee;">
                    <button id="gal-batch-add-char" class="gal-action-btn" style="width: 100%; justify-content: center; background: #fff; color: ${THEME.accent}; border: 1px dashed ${THEME.accent};">
                        <i class="fa-solid fa-plus"></i> 新增未获取角色
                    </button>
                </div>
                <div id="gal-batch-char-list" style="flex: 1; overflow-y: auto; padding: 5px;">
                    <!-- Character List -->
                </div>
            </div>

            <!-- Main Content -->
            <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
                <div style="flex: 1; overflow-y: auto; padding: 20px;">
                    <!-- Character Name Display -->
                    <div style="margin-bottom: 15px;">
                      <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-user"></i> 当前角色
                      </label>
                      <input type="text" id="gal-batch-character" value="${characterId || ''}"
                             placeholder="请在左侧选择或添加角色"
                             readonly
                             style="width: 100%; padding: 10px 15px; border: 2px solid #eee; background: #f9f9f9; font-size: 1rem; box-sizing: border-box; border-radius: 4px; color: #555;">
                    </div>

                    <!-- Upload Tabs & Areas -->
                    <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
                        <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
                        <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
                    </div>

                    <div id="gal-upload-local" class="gal-upload-pane">
                        <input type="file" id="gal-grid-file-input" accept="image/*" style="display: none;">
                        <div id="gal-grid-upload-area" class="gal-upload-card" style="margin-bottom: 15px; min-height: 180px; cursor: pointer;">
                          <i class="fa-solid fa-images" style="font-size: 3rem;"></i>
                          <span style="font-size: 1.1rem; margin-top: 10px;">点击上传表情合集图</span>
                          <small style="color: #888; margin-top: 5px;">支持包含多个表情的大图（如3x3、2x5等排列）</small>
                          <small style="color: ${THEME.accent}; margin-top: 3px;">上传后可调整网格切分</small>
                        </div>
                    </div>

                    <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
                        <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc; text-align: center; min-height: 180px; display: flex; flex-direction: column; justify-content: center;">
                          <div style="margin-bottom: 15px;">
                            <input type="text" id="gal-batch-remote-url" placeholder="输入图片 URL (https://...)"
                                   style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
                          </div>
                          <button class="gal-action-btn" id="gal-batch-fetch-btn" style="width: 100%;">
                            <i class="fa-solid fa-download"></i> 获取图片
                          </button>
                        </div>
                    </div>

                    <!-- Grid Preview -->
                    <div id="gal-grid-preview-area" style="display: none;">
                         <div style="background: #1a1a2e; border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                              <!-- Grid Controls -->
                              <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 15px; flex-wrap: wrap;">
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <label style="color: #fff; font-weight: 600; font-size: 0.9rem;">行数:</label>
                                  <button class="gal-grid-btn" data-action="row-dec">−</button>
                                  <span id="gal-grid-rows" style="color: ${THEME.accent}; font-weight: 700; min-width: 30px; text-align: center; font-size: 1.1rem;">2</span>
                                  <button class="gal-grid-btn" data-action="row-inc">+</button>
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px;">
                                  <label style="color: #fff; font-weight: 600; font-size: 0.9rem;">列数:</label>
                                  <button class="gal-grid-btn" data-action="col-dec">−</button>
                                  <span id="gal-grid-cols" style="color: ${THEME.accent}; font-weight: 700; min-width: 30px; text-align: center; font-size: 1.1rem;">3</span>
                                  <button class="gal-grid-btn" data-action="col-inc">+</button>
                                </div>
                                <div style="margin-left: auto; display: flex; gap: 8px;">
                                  <button class="gal-crop-btn" id="gal-grid-change-image" style="background: #666; color: #fff;">
                                    <i class="fa-solid fa-image"></i> 换图
                                  </button>
                                  <button class="gal-crop-btn" id="gal-grid-auto-detect" style="background: ${THEME.accent}; color: ${THEME.dark};">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> 自动检测
                                  </button>
                                </div>
                              </div>
                              <div id="gal-grid-canvas-container" style="position: relative; width: 100%; overflow: hidden; border-radius: 6px; background: #000;">
                                <canvas id="gal-grid-canvas" style="display: block; max-width: 100%; margin: 0 auto;"></canvas>
                              </div>
                          </div>

                          <!-- Mapping -->
                          <div style="margin-bottom: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                              <span style="font-weight: 700; color: ${THEME.dark};">
                                <i class="fa-solid fa-tags"></i> 表情映射
                              </span>
                              <small style="color: #888;">点击格子可修改表情名称，留空表示跳过</small>
                            </div>
                            <div id="gal-grid-mapping" class="gal-grid-mapping-container"></div>
                          </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="gal-input-actions" style="display: flex; gap: 12px; padding: 15px 20px; border-top: 1px solid #eee; background: #fff; flex-shrink: 0;">
                    <button class="gal-action-btn" id="gal-batch-cancel" style="flex: 1; min-height: 44px;">
                      <span>关闭</span>
                    </button>
                    <button class="gal-action-btn primary" id="gal-batch-confirm" style="flex: 2; min-height: 44px;" disabled>
                      <i class="fa-solid fa-save"></i>
                      <span>保存所有立绘</span>
                    </button>
                </div>
            </div>
          </div>
        </div>
      <style>
        .gal-grid-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 4px;
          background: ${THEME.accent};
          color: ${THEME.dark};
          font-size: 1.2rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }
        .gal-grid-btn:hover {
          background: #fff;
          transform: scale(1.1);
        }
        .gal-grid-mapping-container {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 10px;
          max-height: 200px;
          overflow-y: auto;
          padding: 5px;
        }
        .gal-grid-cell {
          border: 2px solid #ddd;
          border-radius: 6px;
          padding: 8px;
          text-align: center;
          background: #fafafa;
          cursor: pointer;
          transition: all 0.2s;
        }
        .gal-grid-cell:hover {
          border-color: ${THEME.accent};
          background: rgba(0, 210, 255, 0.1);
        }
        .gal-grid-cell.active {
          border-color: ${THEME.accent};
          background: rgba(0, 210, 255, 0.15);
        }
        .gal-grid-cell.skipped {
          opacity: 0.5;
          background: #eee;
        }
        .gal-grid-cell-preview {
          width: 100%;
          aspect-ratio: 2 / 3;
          background: #ddd;
          border-radius: 4px;
          margin-bottom: 5px;
          overflow: hidden;
        }
        .gal-grid-cell-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gal-grid-cell-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: ${THEME.dark};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gal-grid-cell-select {
          width: 100%;
          border: 1px solid #ccc;
          border-radius: 3px;
          padding: 3px 5px;
          font-size: 0.75rem;
          box-sizing: border-box;
        }
        .gal-grid-cell-select:focus {
          outline: none;
          border-color: ${THEME.accent};
        }
        .gal-char-item {
            padding: 10px;
            cursor: pointer;
            border-radius: 4px;
            margin-bottom: 5px;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            color: #333;
        }
        .gal-char-item:hover {
            background: #e9ecef;
        }
        .gal-char-item.active {
            background: ${THEME.accent};
            color: #fff;
            font-weight: bold;
        }
      </style>
    `;
    $(topWindow.document.body).append(modalHtml);
    const $modal = $('#gal-batch-upload-modal');
    makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
    const $fileInput = $('#gal-grid-file-input');
    const $uploadArea = $('#gal-grid-upload-area');
    const $previewArea = $('#gal-grid-preview-area');
    const $confirmBtn = $('#gal-batch-confirm');
    const $canvas = $('#gal-grid-canvas')[0];
    const ctx = $canvas.getContext('2d');
    let loadedImage = null;
    let gridRows = 2;
    let gridCols = 3;
    let cellMappings = []; // [{row, col, expression, skip}]
    let existingChars = new Set(); // 存储已有立绘的角色

    // 异步获取已有立绘的角色
    getAllSprites().then(sprites => {
      existingChars = new Set(sprites.map(s => s.characterId));
      // 如果侧边栏已经渲染，则刷新
      if ($('#gal-batch-char-list').length > 0) {
        const currentFilter = $('#gal-batch-search-char').val() || '';
        renderSidebar(currentFilter);
      }
    });

    // 渲染侧边栏角色列表
    const renderSidebar = (filter = '') => {
      const $list = $('#gal-batch-char-list');
      $list.empty();
      const allChars = getCharacterListFromDatabase();
      // 确保当前角色在列表中
      if (characterId && !allChars.find(c => c.name === characterId)) {
        allChars.unshift({ name: characterId, type: '自定义', source: '本次' });
      }
      const filtered = allChars.filter(c => c.name.toLowerCase().includes(filter.toLowerCase()));

      filtered.forEach(char => {
        const isActive = $('#gal-batch-character').val() === char.name;
        const hasSprites = existingChars.has(char.name);
        const $item = $(`
                    <div class="gal-char-item ${isActive ? 'active' : ''}" data-name="${char.name}">
                        <div style="width: 24px; height: 24px; background: #ddd; border-radius: 50%; margin-right: 8px; overflow: hidden;">
                             <i class="fa-solid fa-user" style="line-height: 24px; text-align: center; width: 100%; color: #fff;"></i>
                        </div>
                        <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${char.name}</div>
                        ${hasSprites ? '<i class="fa-solid fa-images" style="color: #28a745; margin-left: 8px; font-size: 0.9em;" title="已有立绘"></i>' : ''}
                    </div>
                `);
        $item.on('click', function () {
          $('#gal-batch-character').val(char.name);
          $list.find('.gal-char-item').removeClass('active');
          $(this).addClass('active');
        });
        $list.append($item);
      });
    };
    renderSidebar();

    $('#gal-batch-search-char').on('input', function () {
      renderSidebar($(this).val());
    });

    $('#gal-batch-add-char').on('click', () => {
      const name = prompt('请输入新角色名称:');
      if (name && name.trim()) {
        const newName = name.trim();
        $('#gal-batch-character').val(newName);
        const $list = $('#gal-batch-char-list');
        $list.find('.gal-char-item').removeClass('active');
        const $item = $(`
                    <div class="gal-char-item active" data-name="${newName}">
                        <div style="width: 24px; height: 24px; background: #ddd; border-radius: 50%; margin-right: 8px; overflow: hidden;">
                                <i class="fa-solid fa-user" style="line-height: 24px; text-align: center; width: 100%; color: #fff;"></i>
                        </div>
                        <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${newName}</div>
                    </div>
                `);
        $item.on('click', function () {
          $('#gal-batch-character').val(newName);
          $list.find('.gal-char-item').removeClass('active');
          $(this).addClass('active');
        });
        $list.prepend($item);
      }
    });
    // Tab 切换
    $modal.find('.gal-upload-tab').on('click', function () {
      const target = $(this).data('target');
      $modal
        .find('.gal-upload-tab')
        .removeClass('active')
        .css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
      $(this)
        .addClass('active')
        .css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
      $modal.find('.gal-upload-pane').hide();
      $modal.find(`#gal-upload-${target}`).show();
    });
    // 点击上传区域
    $uploadArea.on('click', () => $fileInput.click());
    $('#gal-grid-change-image').on('click', () => $fileInput.click());
    // 处理文件选择
    function handleFileSelect(file) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          loadedImage = img;
          // 智能检测网格（基于图片尺寸猜测）
          autoDetectGrid(img);
          // 显示预览
          $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
          $previewArea.show();
          $confirmBtn.prop('disabled', false);
          renderGridPreview();
          updateMappingUI();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }
    // 远程图片获取
    $('#gal-batch-fetch-btn').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        const url = $('#gal-batch-remote-url').val().trim();
        if (!url) return showToast('请输入图片链接');
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 获取中...');
        try {
          const response = yield fetch(url);
          if (!response.ok) throw new Error('网络请求失败');
          const blob = yield response.blob();
          if (!blob.type.startsWith('image/')) throw new Error('链接不是有效的图片');
          // 模拟文件选择
          const file = new File([blob], 'remote_grid.png', { type: blob.type });
          handleFileSelect(file);
        } catch (e) {
          showToast('获取失败: ' + e.message);
        } finally {
          $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 获取图片');
        }
      });
    });
    // 文件选择
    $fileInput.on('change', function () {
      const file = this.files[0];
      if (!file) return;
      handleFileSelect(file);
    });
    // 自动检测网格
    function autoDetectGrid(img) {
      const ratio = img.width / img.height;
      // 基于图片比例和常见布局猜测
      if (ratio > 2.5) {
        // 非常宽的图，可能是单行多列
        gridRows = 1;
        gridCols = Math.round(ratio * 1.5);
      } else if (ratio > 1.8) {
        // 宽图，可能是2行
        gridRows = 2;
        gridCols = Math.round(ratio * 2);
      } else if (ratio > 1.2) {
        // 接近正方形偏宽
        gridRows = 2;
        gridCols = 3;
      } else if (ratio > 0.8) {
        // 接近正方形
        gridRows = 3;
        gridCols = 3;
      } else {
        // 高图
        gridRows = Math.round(3 / ratio);
        gridCols = 2;
      }
      // 限制范围
      gridRows = Math.max(1, Math.min(5, gridRows));
      gridCols = Math.max(1, Math.min(6, gridCols));
      updateGridDisplay();
    }
    // 更新网格显示
    function updateGridDisplay() {
      $('#gal-grid-rows').text(gridRows);
      $('#gal-grid-cols').text(gridCols);
    }
    // 渲染网格预览
    function renderGridPreview() {
      if (!loadedImage) return;
      const container = $('#gal-grid-canvas-container');
      const maxWidth = container.width() || 800;
      const maxHeight = 400;
      // 计算缩放
      const scale = Math.min(maxWidth / loadedImage.width, maxHeight / loadedImage.height, 1);
      const displayWidth = loadedImage.width * scale;
      const displayHeight = loadedImage.height * scale;
      $canvas.width = displayWidth;
      $canvas.height = displayHeight;
      // 绘制图片
      ctx.drawImage(loadedImage, 0, 0, displayWidth, displayHeight);
      // 绘制网格线
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const cellWidth = displayWidth / gridCols;
      const cellHeight = displayHeight / gridRows;
      // 垂直线
      for (let i = 1; i < gridCols; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cellWidth, 0);
        ctx.lineTo(i * cellWidth, displayHeight);
        ctx.stroke();
      }
      // 水平线
      for (let i = 1; i < gridRows; i++) {
        ctx.beginPath();
        ctx.moveTo(0, i * cellHeight);
        ctx.lineTo(displayWidth, i * cellHeight);
        ctx.stroke();
      }
      // 绘制单元格编号
      ctx.setLineDash([]);
      ctx.font = 'bold 16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let cellIndex = 0;
      for (let row = 0; row < gridRows; row++) {
        for (let col = 0; col < gridCols; col++) {
          const x = col * cellWidth + cellWidth / 2;
          const y = row * cellHeight + cellHeight / 2;
          // 绘制编号背景
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.beginPath();
          ctx.arc(x, y, 15, 0, Math.PI * 2);
          ctx.fill();
          // 绘制编号
          ctx.fillStyle = '#fff';
          ctx.fillText(String(cellIndex + 1), x, y);
          cellIndex++;
        }
      }
    }
    // 更新映射UI
    function updateMappingUI() {
      const $container = $('#gal-grid-mapping');
      $container.empty();
      const totalCells = gridRows * gridCols;
      cellMappings = [];
      // 预设表情列表
      const defaultExpressions = [...EXPRESSION_LIST];
      for (let i = 0; i < totalCells; i++) {
        const row = Math.floor(i / gridCols);
        const col = i % gridCols;
        const defaultExpr = defaultExpressions[i] || '';
        cellMappings.push({
          row,
          col,
          expression: defaultExpr,
          skip: !defaultExpr,
        });
        // 创建单元格预览（使用下拉选择框）
        const $cell = $(`
          <div class="gal-grid-cell ${!defaultExpr ? 'skipped' : ''}" data-index="${i}">
            <div class="gal-grid-cell-preview" id="gal-cell-preview-${i}"></div>
            <select class="gal-grid-cell-select" data-index="${i}">
              <option value="">-- 跳过 --</option>
            </select>
          </div>
        `);
        $container.append($cell);
        // 绘制单元格预览
        setTimeout(() => renderCellPreview(i), 50);
      }
      // 初始化所有下拉框选项
      updateAllSelectOptions();
      // 表情选择事件
      $container.find('.gal-grid-cell-select').on('change', function () {
        const index = parseInt($(this).data('index'));
        const newValue = $(this).val();
        cellMappings[index].expression = newValue;
        cellMappings[index].skip = !newValue;
        const $cell = $(this).closest('.gal-grid-cell');
        if (!newValue) {
          $cell.addClass('skipped');
        } else {
          $cell.removeClass('skipped');
        }
        // 更新所有下拉框的可选项（排除已选择的）
        updateAllSelectOptions();
      });
    }
    // 更新所有下拉框的选项（排除已被其他格子选中的表情）
    function updateAllSelectOptions() {
      // 收集已使用的表情
      const usedExpressions = new Set();
      cellMappings.forEach(m => {
        if (m.expression) {
          usedExpressions.add(m.expression);
        }
      });
      // 更新每个下拉框
      $('#gal-grid-mapping .gal-grid-cell-select').each(function () {
        const index = parseInt($(this).data('index'));
        const currentValue = cellMappings[index].expression;
        const $select = $(this);
        // 保存当前选中值
        const savedValue = currentValue;
        // 清空并重建选项
        $select.empty();
        $select.append('<option value="">-- 跳过 --</option>');
        // 添加所有表情选项
        allExpressions.forEach(expr => {
          // 显示条件：未被其他格子使用 或者 是当前格子选中的值
          if (!usedExpressions.has(expr) || expr === currentValue) {
            const selected = expr === savedValue ? 'selected' : '';
            $select.append(`<option value="${expr}" ${selected}>${expr}</option>`);
          }
        });
      });
    }
    // 渲染单元格预览
    function renderCellPreview(index) {
      if (!loadedImage) return;
      const mapping = cellMappings[index];
      if (!mapping) return;
      const cellWidth = loadedImage.width / gridCols;
      const cellHeight = loadedImage.height / gridRows;
      const sx = mapping.col * cellWidth;
      const sy = mapping.row * cellHeight;
      // 创建临时canvas提取单元格图像
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = cellWidth;
      tempCanvas.height = cellHeight;
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.drawImage(loadedImage, sx, sy, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
      // 显示预览
      const $preview = $(`#gal-cell-preview-${index}`);
      $preview.html(`<img src="${tempCanvas.toDataURL()}" alt="Cell ${index + 1}">`);
    }
    // 网格调整按钮
    $modal.find('.gal-grid-btn').on('click', function () {
      const action = $(this).data('action');
      switch (action) {
        case 'row-inc':
          if (gridRows < 5) gridRows++;
          break;
        case 'row-dec':
          if (gridRows > 1) gridRows--;
          break;
        case 'col-inc':
          if (gridCols < 6) gridCols++;
          break;
        case 'col-dec':
          if (gridCols > 1) gridCols--;
          break;
      }
      updateGridDisplay();
      renderGridPreview();
      updateMappingUI();
    });
    // 自动检测按钮
    $('#gal-grid-auto-detect').on('click', () => {
      if (loadedImage) {
        autoDetectGrid(loadedImage);
        renderGridPreview();
        updateMappingUI();
        showToast('已重新检测网格');
      }
    });
    // 统一关闭处理
    const handleClose = () => {
      $modal.remove();
      if (typeof onCloseCallback === 'function') {
        try {
          onCloseCallback();
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
        }
      }
    };
    // 取消
    $('#gal-batch-cancel').on('click', handleClose);
    $modal.on('click', function (e) {
      if (e.target === this) handleClose();
    });
    // 保存所有
    $('#gal-batch-confirm').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        const charName = $('#gal-batch-character').val().trim();
        if (!charName) {
          showToast('请输入角色名称');
          return;
        }
        if (!loadedImage) {
          showToast('请先上传图片');
          return;
        }
        // 检查有效映射
        const validMappings = cellMappings.filter(m => !m.skip && m.expression);
        if (validMappings.length === 0) {
          showToast('请至少设置一个表情名称');
          return;
        }
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 处理中...');
        const cellWidth = loadedImage.width / gridCols;
        const cellHeight = loadedImage.height / gridRows;
        let savedCount = 0;
        let failedCount = 0;
        for (const mapping of validMappings) {
          try {
            // 提取单元格图像
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = cellWidth;
            tempCanvas.height = cellHeight;
            const tempCtx = tempCanvas.getContext('2d');
            const sx = mapping.col * cellWidth;
            const sy = mapping.row * cellHeight;
            tempCtx.drawImage(loadedImage, sx, sy, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
            // 转换为2:3比例的立绘
            const outputWidth = 400;
            const outputHeight = 600;
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = outputWidth;
            outputCanvas.height = outputHeight;
            const outputCtx = outputCanvas.getContext('2d');
            // 计算裁剪区域（居中裁剪为2:3）
            const srcAspect = cellWidth / cellHeight;
            const dstAspect = 2 / 3;
            let cropWidth, cropHeight, cropX, cropY;
            if (srcAspect > dstAspect) {
              // 源图更宽，裁剪宽度
              cropHeight = cellHeight;
              cropWidth = cellHeight * dstAspect;
              cropX = (cellWidth - cropWidth) / 2;
              cropY = 0;
            } else {
              // 源图更高，裁剪高度
              cropWidth = cellWidth;
              cropHeight = cellWidth / dstAspect;
              cropX = 0;
              cropY = (cellHeight - cropHeight) / 2;
            }
            // 从原始图像直接裁剪
            outputCtx.drawImage(
              loadedImage,
              sx + cropX,
              sy + cropY,
              cropWidth,
              cropHeight,
              0,
              0,
              outputWidth,
              outputHeight,
            );
            // 保存
            const blob = yield new Promise(resolve => outputCanvas.toBlob(resolve, 'image/png', 1));
            yield saveSprite(charName, mapping.expression, blob);
            savedCount++;
            console.log(`[${SCRIPT_NAME}] 已保存: ${charName} - ${mapping.expression}`);
          } catch (e) {
            console.error(`[${SCRIPT_NAME}] 保存 ${mapping.expression} 失败:`, e);
            failedCount++;
          }
        }
        if (failedCount > 0) {
          showToast(`保存完成: ${savedCount} 成功, ${failedCount} 失败`);
        } else {
          showToast(`已保存 ${savedCount} 张立绘`);
        }

        // 重置UI允许继续上传
        loadedImage = null;
        $previewArea.hide();
        $modal.find('.gal-upload-tabs').show();
        const activeTab = $modal.find('.gal-upload-tab.active').data('target') || 'local';
        $modal.find('.gal-upload-pane').hide();
        $modal.find(`#gal-upload-${activeTab}`).show();
        $fileInput.val('');

        $(this).prop('disabled', true).html('<i class="fa-solid fa-save"></i> <span>保存所有立绘</span>');

        refreshGalgameViews();
      });
    });
  }

  /**
   * 自定义表情标签管理器
   */
  function showCustomExpressionManager(onCloseCallback) {
    const customExpressions = getCustomExpressions();
    const modalHtml = `
            <div class="gal-input-modal" id="gal-expression-manager-modal">
                <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px;">
                    <div class="gal-input-title" style="margin-bottom: 20px;">
                        <span><i class="fa-solid fa-face-smile"></i> 管理表情标签</span>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            预设表情 (不可编辑)
                        </label>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px;">
                            ${EXPRESSION_LIST.map(e => `<span class="gal-tag gal-preset-tag">${e}</span>`).join('')}
                        </div>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            自定义表情
                        </label>
                        <div id="gal-custom-expressions-list" style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 15px; min-height: 40px; border: 1px dashed #ddd; padding: 10px; border-radius: 6px;">
                            ${
                              customExpressions.length > 0
                                ? customExpressions
                                    .map(
                                      e => `
                                <span class="gal-tag gal-custom-tag" data-expr="${e}">
                                    ${e} <i class="fa-solid fa-xmark gal-remove-expr" title="删除"></i>
                                </span>
                            `,
                                    )
                                    .join('')
                                : '<span style="color: #999;">暂无自定义表情</span>'
                            }
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <input type="text" id="gal-new-expression-input" placeholder="添加新表情标签"
                                   style="flex: 1; padding: 10px 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.95rem; color: #333; background: #fff;">
                            <button class="gal-action-btn primary" id="gal-add-expression-btn" style="padding: 10px 15px;">
                                <i class="fa-solid fa-plus"></i> 添加
                            </button>
                        </div>
                    </div>
                    <div class="gal-input-actions" style="margin-top: 20px;">
                        <button class="gal-action-btn" id="gal-expr-manager-close" style="width: 100%; min-height: 44px;">
                            <span>关闭</span>
                        </button>
                    </div>
                </div>
            </div>
            <style>
                .gal-tag {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 10px;
                    border-radius: 20px;
                    font-size: 0.85rem;
                    font-weight: 600;
                    white-space: nowrap;
                }
                .gal-preset-tag {
                    background: #e9ecef;
                    color: #495057;
                }
                .gal-custom-tag {
                    background: ${THEME.accent};
                    color: ${THEME.dark};
                }
                .gal-remove-expr {
                    margin-left: 8px;
                    cursor: pointer;
                    font-size: 0.75rem;
                    opacity: 0.7;
                }
                .gal-remove-expr:hover {
                    opacity: 1;
                    color: #e74c3c;
                }
            </style>
        `;

    $(topWindow.document.body).append(modalHtml);
    const $modal = $('#gal-expression-manager-modal');
    makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));

    const renderCustomExpressions = () => {
      const currentCustomExpressions = getCustomExpressions();
      const $list = $('#gal-custom-expressions-list');
      $list.empty();
      if (currentCustomExpressions.length > 0) {
        $list.html(
          currentCustomExpressions
            .map(
              e => `
                    <span class="gal-tag gal-custom-tag" data-expr="${e}">
                        ${e} <i class="fa-solid fa-xmark gal-remove-expr" title="删除"></i>
                    </span>
                `,
            )
            .join(''),
        );
      } else {
        $list.html('<span style="color: #999;">暂无自定义表情</span>');
      }
    };

    $('#gal-add-expression-btn').on('click', () => {
      const newExpr = $('#gal-new-expression-input').val().trim();
      if (newExpr) {
        addCustomExpression(newExpr);
        $('#gal-new-expression-input').val('');
        renderCustomExpressions();
        showToast(`已添加表情: ${newExpr}`);
      }
    });

    $('#gal-custom-expressions-list').on('click', '.gal-remove-expr', function () {
      // 使用 attr 确保取到的是字符串，避免 jQuery data() 自动类型转换导致无法匹配
      const exprToRemove = $(this).parent().attr('data-expr');
      if (confirm(`确定删除自定义表情「${exprToRemove}」吗？\n注意：这不会删除已使用该表情的立绘。`)) {
        removeCustomExpression(exprToRemove).then(success => {
          if (success) {
            renderCustomExpressions();
            // showToast 已在 removeCustomExpression 中调用
          }
        });
      }
    });

    const handleClose = () => {
      $modal.remove();
      if (typeof onCloseCallback === 'function') {
        try {
          onCloseCallback();
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
        }
      }
    };

    $('#gal-expr-manager-close').on('click', handleClose);
    $modal.on('click', function (e) {
      if (e.target === this) handleClose();
    });
  }
  // 导入 JSON 资源配置
  function importAssetsFromJson(file) {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        const text = yield file.text();
        const json = JSON.parse(text);
        let count = 0;
        if (json.sprites) {
          for (const s of json.sprites) {
            if (s.characterId && s.expression && s.url) {
              yield saveSprite(s.characterId, s.expression, null, s.url);
              count++;
            }
          }
        }
        if (json.backgrounds) {
          for (const bg of json.backgrounds) {
            if (bg.sceneName && bg.url) {
              yield saveBackground(bg.sceneName, null, bg.url);
              count++;
            }
          }
        }
        showToast(`成功导入 ${count} 个远程资源链接`);
      } catch (e) {
        console.error('JSON导入失败', e);
        showToast('JSON导入失败: ' + e.message);
      }
    });
  }
  // ============================================
  // 资源导入导出管理器 (Asset IO Manager)
  // ============================================
  const AssetIO = {
    jszip: null,
    // 加载 JSZip 库
    loadJSZip() {
      return __awaiter(this, void 0, void 0, function* () {
        if (this.jszip) return this.jszip;
        if (window.JSZip) {
          this.jszip = window.JSZip;
          return this.jszip;
        }
        return new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
          script.onload = () => {
            this.jszip = window.JSZip;
            console.log(`[${SCRIPT_NAME}] JSZip 加载成功`);
            resolve(this.jszip);
          };
          script.onerror = () => reject(new Error('JSZip load failed'));
          document.head.appendChild(script);
        });
      });
    },
    // 导出所有资源为 ZIP
    exportAllAssets() {
      return __awaiter(this, arguments, void 0, function* (remoteBaseUrl = null) {
        try {
          showToast('正在准备导出...');
          const zip = new (yield this.loadJSZip())();
          // 远程配置对象
          const remoteConfig = {
            sprites: [],
            backgrounds: [],
          };
          // 确保baseUrl以/结尾
          const baseUrl = remoteBaseUrl ? (remoteBaseUrl.endsWith('/') ? remoteBaseUrl : remoteBaseUrl + '/') : '';
          // 导出立绘
          const sprites = yield getAllSprites();
          const spritesFolder = zip.folder('sprites');
          for (const s of sprites) {
            if (s.imageBlob) {
              // 命名格式: 角色名_表情.png (根据MIME类型决定后缀)
              const ext = s.imageBlob.type.split('/')[1] || 'png';
              // 文件名清理，替换非法字符
              const safeChar = s.characterId.replace(/[\\/:*?"<>|]/g, '');
              const safeExpr = s.expression.replace(/[\\/:*?"<>|]/g, '');
              const filename = `${safeChar}_${safeExpr}.${ext}`;
              spritesFolder.file(filename, s.imageBlob);
              if (remoteBaseUrl) {
                remoteConfig.sprites.push({
                  characterId: s.characterId,
                  expression: s.expression,
                  url: `${baseUrl}sprites/${filename}`,
                });
              }
            }
          }
          // 导出背景
          const backgrounds = yield getAllBackgrounds();
          const bgFolder = zip.folder('backgrounds');
          for (const bg of backgrounds) {
            if (bg.imageBlob) {
              const ext = bg.imageBlob.type.split('/')[1] || 'png';
              const safeScene = bg.sceneName.replace(/[\\/:*?"<>|]/g, '');
              const filename = `${safeScene}.${ext}`;
              bgFolder.file(filename, bg.imageBlob);
              if (remoteBaseUrl) {
                remoteConfig.backgrounds.push({
                  sceneName: bg.sceneName,
                  url: `${baseUrl}backgrounds/${filename}`,
                });
              }
            }
          }
          // 如果有远程链接，生成JSON文件
          if (remoteBaseUrl) {
            zip.file('remote_assets.json', JSON.stringify(remoteConfig, null, 2));
          }
          showToast('正在压缩打包...');
          const content = yield zip.generateAsync({ type: 'blob' });
          // 下载文件
          const url = URL.createObjectURL(content);
          const a = document.createElement('a');
          a.href = url;
          a.download = `galgame_assets_${new Date().toISOString().slice(0, 10)}.zip`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('导出成功！');
        } catch (e) {
          console.error(`[${SCRIPT_NAME}] 导出失败:`, e);
          showToast('导出失败: ' + e.message);
        }
      });
    },
    // 批量导入文件 (File List)
    importFiles(fileList) {
      return __awaiter(this, void 0, void 0, function* () {
        let successCount = 0;
        let failCount = 0;
        showToast('开始导入...');
        for (const file of fileList) {
          try {
            // 检查是否在文件夹中 (webkitRelativePath)
            const path = file.webkitRelativePath || file.name;
            const isSpriteFolder = path.includes('sprites/');
            const isBgFolder = path.includes('backgrounds/');
            let imported = false;
            // 1. 根据文件夹判断
            if (isSpriteFolder) {
              yield this.importAsSprite(file);
              imported = true;
            } else if (isBgFolder) {
              yield this.importAsBackground(file);
              imported = true;
            }
            // 2. 根据文件名格式判断 (Name_Expression.ext)
            else if (file.name.includes('_')) {
              yield this.importAsSprite(file);
              imported = true;
            }
            // 3. 默认为背景 (Label.ext)
            else {
              yield this.importAsBackground(file);
              imported = true;
            }
            if (imported) successCount++;
          } catch (e) {
            console.warn(`[${SCRIPT_NAME}] 导入文件 ${file.name} 失败:`, e);
            failCount++;
          }
        }
        showToast(`导入完成: ${successCount} 成功, ${failCount} 失败`);
        return successCount > 0;
      });
    },
    // 导入为立绘
    importAsSprite(file) {
      return __awaiter(this, void 0, void 0, function* () {
        // 解析文件名: Name_Expression.ext
        // 移除路径前缀
        const fileName = file.name.split('/').pop();
        const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
        // 查找分隔符
        const parts = nameWithoutExt.split('_');
        if (parts.length >= 2) {
          // 假设最后一个部分是表情，前面的是角色名（可能包含下划线）
          const expression = parts.pop();
          const characterId = parts.join('_');
          if (characterId && expression) {
            yield saveSprite(characterId, expression, file);
            console.log(`[${SCRIPT_NAME}] 导入立绘: ${characterId} - ${expression}`);
            return;
          }
        }
        // 如果解析失败或不符合格式，抛出异常或作为默认处理
        throw new Error('文件名格式不匹配 Name_Expression.ext');
      });
    },
    // 导入为背景
    importAsBackground(file) {
      return __awaiter(this, void 0, void 0, function* () {
        const fileName = file.name.split('/').pop();
        const sceneName = fileName.substring(0, fileName.lastIndexOf('.'));
        if (sceneName) {
          yield saveBackground(sceneName, file);
          console.log(`[${SCRIPT_NAME}] 导入背景: ${sceneName}`);
        }
      });
    },
    // 从 GitHub 导入
    importFromGitHub(repoUrl) {
      return __awaiter(this, void 0, void 0, function* () {
        try {
          // 解析 URL
          // 支持格式: https://github.com/user/repo/tree/main/path
          // 或 user/repo
          let owner,
            repo,
            path = '';
          let branch = 'main';
          if (repoUrl.startsWith('http')) {
            const urlObj = new URL(repoUrl);
            const parts = urlObj.pathname.split('/').filter(p => p);
            if (parts.length >= 2) {
              owner = parts[0];
              repo = parts[1];
              if (parts[2] === 'tree' || parts[2] === 'blob') {
                branch = parts[3];
                path = parts.slice(4).join('/');
              }
            }
          } else {
            const parts = repoUrl.split('/');
            if (parts.length >= 2) {
              owner = parts[0];
              repo = parts[1];
              if (parts.length > 2) path = parts.slice(2).join('/');
            }
          }
          if (!owner || !repo) {
            throw new Error('无效的 GitHub 仓库地址');
          }
          showToast(`正在获取文件列表: ${owner}/${repo}...`);
          // 使用 GitHub API 获取内容
          const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
          const response = yield fetch(apiUrl);
          if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
          const data = yield response.json();
          if (!Array.isArray(data)) throw new Error('路径不是一个目录');
          // 过滤图片文件
          const imageFiles = data.filter(item => item.type === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(item.name));
          if (imageFiles.length === 0) {
            showToast('该目录下没有找到图片文件');
            return;
          }
          if (!confirm(`找到 ${imageFiles.length} 张图片，是否开始导入？`)) return;
          let count = 0;
          for (const item of imageFiles) {
            showToast(`正在下载 (${count + 1}/${imageFiles.length}): ${item.name}`);
            try {
              // 下载图片 Blob
              // 使用 download_url (raw content)
              const imgRes = yield fetch(item.download_url);
              const blob = yield imgRes.blob();
              // 构造成 File 对象以复用逻辑
              const file = new File([blob], item.name, { type: blob.type });
              // 复用导入逻辑
              // 如果 path 包含 sprites/ 或 backgrounds/ 可以传递 context，但这里简单起见只看文件名
              // 或者我们可以检查 path
              let imported = false;
              // 简单的路径判断 (如果是递归获取可以更准，但这里只获取了一层)
              // 我们可以尝试在文件名判断前加逻辑
              if (item.name.includes('_')) {
                yield this.importAsSprite(file);
                imported = true;
              } else {
                yield this.importAsBackground(file);
                imported = true;
              }
              if (imported) count++;
            } catch (e) {
              console.error(`下载/导入 ${item.name} 失败:`, e);
            }
          }
          showToast(`GitHub 导入完成，共 ${count} 张图片`);
          return true;
        } catch (e) {
          console.error('GitHub Import Error:', e);
          showToast('GitHub 导入失败: ' + e.message);
          return false;
        }
      });
    },
  };

  /**
   * 显示远程ZIP导入对话框
   */
  function showRemoteZipImportDialog() {
    // ... (HTML unchanged)
    const dialogHtml = `
            <div class="gal-input-modal" id="gal-remote-zip-dialog">
            <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px;">
                <div class="gal-input-title" style="margin-bottom: 20px;">
                <span><i class="fa-solid fa-cloud-arrow-down"></i> 远程压缩包导入</span>
                </div>

                <div style="margin-bottom: 15px;">
                <label style="display: block; font-weight: 700; margin-bottom: 8px; color: #2b2e38;">
                    <i class="fa-solid fa-link"></i> ZIP 文件链接
                </label>
                <input type="text" id="gal-remote-zip-url"
                        placeholder="https://example.com/assets.zip"
                        style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 6px;">
                <small style="color: #888; margin-top: 5px; display: block;">
                    支持直接下载链接，如 GitHub Release、云盘直链等<br>
                    <strong style="color: #e74c3c;">限制：最大 5GB</strong>
                </small>
                </div>

                <div class="gal-input-actions" style="display: flex; gap: 12px;">
                <button class="gal-action-btn" id="gal-remote-zip-cancel" style="flex: 1; min-height: 44px; justify-content: center;">
                    <span>取消</span>
                </button>
                <button class="gal-action-btn primary" id="gal-remote-zip-confirm" style="flex: 1; min-height: 44px; justify-content: center;">
                    <i class="fa-solid fa-download"></i>
                    <span>下载并导入</span>
                </button>
                </div>
            </div>
            </div>
        `;

    $(topWindow.document.body).append(dialogHtml);
    const $dialog = $('#gal-remote-zip-dialog');
    makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

    // 关闭
    $('#gal-remote-zip-cancel').on('click', () => $dialog.remove());
    $dialog.on('click', function (e) {
      if (e.target === this) $dialog.remove();
    });

    // 确认下载
    $('#gal-remote-zip-confirm').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        const url = $('#gal-remote-zip-url').val().trim();
        if (!url) {
          showToast('请输入ZIP文件链接');
          return;
        }

        // 简单的URL验证
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          showToast('请输入有效的 HTTP/HTTPS 链接');
          return;
        }

        $dialog.remove();
        yield importFromRemoteZip(url);
      });
    });
  }

  /**
   * 从本地ZIP文件导入资源
   * @param {File} file - ZIP文件
   */
  function importFromZipFile(file) {
    return __awaiter(this, void 0, void 0, function* () {
      let isCancelled = false;
      const progressController = showImportProgress('正在解压本地文件...', () => {
        isCancelled = true;
        showToast('导入已手动取消');
      });

      try {
        const JSZip = yield AssetIO.loadJSZip();
        const zip = yield JSZip.loadAsync(file, {
          // 进度回调
          onprogress: event => {
            if (isCancelled) return;
            const percent = Math.round(event.percent || 0);
            progressController.update(percent, `解压中... ${percent}%`);
          },
        });

        if (isCancelled) {
          progressController.close();
          return;
        }

        yield processZipContents(zip, progressController, () => isCancelled);

        if (!isCancelled) {
          progressController.close();
          showToast('ZIP导入完成！');
        } else {
          progressController.close();
        }
      } catch (e) {
        progressController.close();
        if (isCancelled) return;

        console.error('ZIP导入失败:', e);
        showImportError(['ZIP文件解析失败', e.message || '未知错误', '请确保文件是有效的ZIP格式']);
      }
    });
  }

  /**
   * 从远程URL导入ZIP资源
   * @param {string} url - ZIP文件URL
   */
  function importFromRemoteZip(url) {
    return __awaiter(this, void 0, void 0, function* () {
      const abortController = new AbortController();
      let isCancelled = false;

      const progressController = showImportProgress('正在下载远程文件...', () => {
        isCancelled = true;
        abortController.abort();
        showToast('下载已取消');
      });

      try {
        // 使用 fetch 下载，支持进度
        const response = yield fetch(url, { signal: abortController.signal });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        // 检查 Content-Length
        const contentLength = response.headers.get('Content-Length');
        const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB

        if (contentLength && parseInt(contentLength) > MAX_SIZE) {
          throw new Error(`文件大小 ${(parseInt(contentLength) / 1024 / 1024 / 1024).toFixed(2)} GB 超过 5GB 限制`);
        }

        // 流式下载并显示进度
        const reader = response.body.getReader();
        const chunks = [];
        let receivedLength = 0;
        const totalLength = contentLength ? parseInt(contentLength) : 0;

        while (true) {
          const { done, value } = yield reader.read();
          if (done) break;

          chunks.push(value);
          receivedLength += value.length;

          // 二次检查大小
          if (receivedLength > MAX_SIZE) {
            throw new Error('下载的文件大小超过 5GB 限制');
          }

          // 更新进度
          if (totalLength > 0) {
            const percent = Math.round((receivedLength / totalLength) * 100);
            const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
            const total = (totalLength / 1024 / 1024).toFixed(1);
            progressController.update(percent, `下载中: ${downloaded} MB / ${total} MB`);
          } else {
            const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
            progressController.update(-1, `下载中: ${downloaded} MB`);
          }
        }

        if (isCancelled) {
          progressController.close();
          return;
        }

        // 合并chunks为Blob
        const blob = new Blob(chunks);
        progressController.update(100, '下载完成，开始解压...');

        // 解压
        const JSZip = yield AssetIO.loadJSZip();
        const zip = yield JSZip.loadAsync(blob);

        yield processZipContents(zip, progressController, () => isCancelled);

        if (!isCancelled) {
          progressController.close();
          showToast('远程ZIP导入完成！');
        } else {
          progressController.close();
        }
      } catch (e) {
        progressController.close();
        if (e.name === 'AbortError' || isCancelled) return;

        console.error('远程ZIP导入失败:', e);
        showImportError(['远程ZIP下载/导入失败', e.message || '网络错误', '请检查链接是否有效、是否支持跨域']);
      }
    });
  }

  /**
   * 处理ZIP包内容 - 批量优化版
   * @param {JSZip} zip - JSZip实例
   * @param {Object} progressController - 进度控制器
   * @param {Function} isCancelledCheck - 检查是否取消的回调
   */
  function processZipContents(zip, progressController, isCancelledCheck) {
    return __awaiter(this, void 0, void 0, function* () {
      // 验证必须存在 sprites 或 backgrounds 目录
      const hasSpritesDir = Object.keys(zip.files).some(path => path.startsWith('sprites/'));
      const hasBackgroundsDir = Object.keys(zip.files).some(path => path.startsWith('backgrounds/'));

      if (!hasSpritesDir && !hasBackgroundsDir) {
        throw new Error('ZIP包格式错误：必须包含 sprites/ 或 backgrounds/ 目录');
      }

      const imageFiles = [];

      // 收集所有图片文件
      zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;

        // 检查是否在正确的目录中
        const isSprite = relativePath.startsWith('sprites/');
        const isBackground = relativePath.startsWith('backgrounds/');

        if (!isSprite && !isBackground) return;

        // 检查是否是图片文件
        const ext = relativePath.split('.').pop().toLowerCase();
        if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return;

        imageFiles.push({
          path: relativePath,
          entry: zipEntry,
          type: isSprite ? 'sprite' : 'background',
        });
      });

      if (imageFiles.length === 0) {
        throw new Error('ZIP包中未找到有效的图片文件');
      }

      progressController.update(0, `准备导入 ${imageFiles.length} 个文件...`);

      // 批量处理配置
      const BATCH_SIZE = 50;
      let successCount = 0;
      let failedItems = [];

      // 分批处理
      for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
        if (isCancelledCheck && isCancelledCheck()) {
          console.log(`[${SCRIPT_NAME}] 导入已取消`);
          return;
        }

        const batch = imageFiles.slice(i, i + BATCH_SIZE);
        const spriteBatch = [];
        const backgroundBatch = [];

        // 并行解压当前批次
        yield Promise.all(
          batch.map(item =>
            __awaiter(this, void 0, void 0, function* () {
              try {
                const blob = yield item.entry.async('blob');
                const fileName = item.path.split('/').pop();

                if (item.type === 'sprite') {
                  const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
                  const parts = nameWithoutExt.split('_');
                  if (parts.length >= 2) {
                    const expression = parts.pop();
                    const characterId = parts.join('_');
                    spriteBatch.push({ characterId, expression, imageBlob: blob });
                  }
                } else if (item.type === 'background') {
                  const sceneName = fileName.substring(0, fileName.lastIndexOf('.'));
                  backgroundBatch.push({ sceneName, imageBlob: blob });
                }
              } catch (e) {
                console.warn(`解压 ${item.path} 失败:`, e);
                failedItems.push({ path: item.path, error: e.message });
              }
            }),
          ),
        );

        // 批量保存到数据库
        if (spriteBatch.length > 0) {
          yield saveSpritesBatch(spriteBatch);
        }
        if (backgroundBatch.length > 0) {
          yield saveBackgroundsBatch(backgroundBatch);
        }

        successCount += spriteBatch.length + backgroundBatch.length;

        // 更新进度
        const processed = Math.min(i + BATCH_SIZE, imageFiles.length);
        const percent = Math.round((processed / imageFiles.length) * 100);
        progressController.update(percent, `导入中: ${processed}/${imageFiles.length} (批量模式)`);
      }

      // 如果有失败项，显示详细错误
      if (failedItems.length > 0) {
        showImportError([
          `成功: ${successCount} 个, 失败: ${failedItems.length} 个`,
          '部分文件导入失败，请检查详情...',
        ]);
      }

      console.log(`[${SCRIPT_NAME}] ZIP导入完成: 成功 ${successCount}, 失败 ${failedItems.length}`);
    });
  }

  /**
   * 显示导入进度遮罩层 (支持取消)
   * @param {string} initialText - 初始文本
   * @param {Function} onCancel - 取消回调
   * @returns {Object} 控制器 { update(p, t), close() }
   */
  function showImportProgress(initialText, onCancel) {
    // 移除可能存在的旧进度条
    $('.gal-import-progress-overlay').remove();

    const html = `
            <div class="gal-import-progress-overlay">
            <div class="gal-import-progress-box">
                <div class="gal-import-progress-title">
                <i class="fa-solid fa-spinner fa-spin"></i> 正在导入资源
                </div>
                <div class="gal-import-progress-bar-container">
                <div class="gal-import-progress-bar"></div>
                </div>
                <div class="gal-import-progress-text">${initialText}</div>
                <div class="gal-import-progress-details"></div>
                <button class="gal-action-btn" id="gal-import-cancel-btn" style="margin-top: 15px; background: #e74c3c; color: #fff; border: none; padding: 6px 15px; font-size: 0.9rem;">
                    <i class="fa-solid fa-xmark"></i> 取消
                </button>
            </div>
            </div>
        `;

    $(topWindow.document.body).append(html);
    const $overlay = $('.gal-import-progress-overlay');

    // 绑定取消事件
    if (onCancel) {
      $overlay.find('#gal-import-cancel-btn').on('click', onCancel);
    } else {
      $overlay.find('#gal-import-cancel-btn').hide();
    }

    return {
      update: (percent, text) => {
        if (percent >= 0) {
          $overlay.find('.gal-import-progress-bar').css('width', percent + '%');
        } else {
          $overlay.find('.gal-import-progress-bar').css('width', '30%');
        }
        $overlay.find('.gal-import-progress-text').text(text);
      },
      close: () => {
        $overlay.fadeOut(300, function () {
          $(this).remove();
        });
      },
    };
  }

  /**
   * 更新导入进度 - 已废弃，请使用 controller.update
   */
  function updateImportProgress($progress, percent, text) {
    // 兼容旧调用 (如果有的话)
    if (percent >= 0) {
      $progress.find('.gal-import-progress-bar').css('width', percent + '%');
    }
    $progress.find('.gal-import-progress-text').text(text);
  }

  /**
   * 隐藏导入进度 - 已废弃，请使用 controller.close
   */
  function hideImportProgress($progress) {
    $progress.fadeOut(300, function () {
      $(this).remove();
    });
  }

  /**
   * 显示导入错误对话框
   * @param {Array<string>} messages - 错误信息数组
   */
  function showImportError(messages) {
    // 移除旧的错误对话框
    $('#gal-import-error-dialog').remove();

    const errorHtml = `
            <div class="gal-input-modal" id="gal-import-error-dialog">
            <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px; border-color: #e74c3c;">
                <div class="gal-input-title" style="margin-bottom: 20px; color: #e74c3c;">
                <span><i class="fa-solid fa-circle-exclamation"></i> 导入出错</span>
                </div>

                <div style="background: #fdf2f2; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin-bottom: 20px; max-height: 300px; overflow-y: auto;">
                ${messages.map(msg => `<div style="margin-bottom: 5px; color: #721c24; font-size: 0.9rem; white-space: pre-wrap;">${msg}</div>`).join('')}
                </div>

                <button class="gal-action-btn" id="gal-import-error-close" style="width: 100%; min-height: 44px; justify-content: center;">
                <span>关闭</span>
                </button>
            </div>
            </div>
        `;

    $(topWindow.document.body).append(errorHtml);
    const $dialog = $('#gal-import-error-dialog');

    $('#gal-import-error-close').on('click', () => $dialog.remove());
    $dialog.on('click', function (e) {
      if (e.target === this) $dialog.remove();
    });
  }
  /**
   * 资源管理器模态框 - 统一管理立绘和背景
   * @param {string} activeTab - 可选，激活的标签页 'sprites' 或 'backgrounds'
   */
  function showAssetManagerModal() {
    return __awaiter(this, arguments, void 0, function* (activeTab = 'sprites') {
      // 获取所有立绘数据
      const allSprites = yield getAllSprites();
      // 获取所有背景数据
      const allBackgrounds = yield getAllBackgrounds();
      // 获取数据库角色列表
      const dbCharacters = getCharacterListFromDatabase();
      // 按角色分组数据 { sprites: [], type: '', source: '' }
      const charactersData = new Map();
      // 1. 先把所有有立绘的角色加进去
      allSprites.forEach(sprite => {
        if (!charactersData.has(sprite.characterId)) {
          charactersData.set(sprite.characterId, {
            sprites: [],
            type: '自定义',
            source: '本地',
          });
        }
        charactersData.get(sprite.characterId).sprites.push(sprite);
      });
      // 2. 遍历数据库角色，合并进去
      dbCharacters.forEach(char => {
        const charName = char.name;
        if (!charactersData.has(charName)) {
          // 没有立绘的角色
          charactersData.set(charName, {
            sprites: [],
            type: char.type,
            source: char.source,
          });
        } else {
          // 已有立绘的角色，更新类型信息
          const info = charactersData.get(charName);
          info.type = char.type;
          info.source = char.source;
        }
      });
      const modalHtml = `
      <div class="gal-input-modal" id="gal-asset-manager-modal">
        <div class="gal-input-box" style="max-width: 900px; width: 95%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
          <!-- 标题栏 -->
          <div style="padding: 20px 25px 15px; border-bottom: 1px solid #e0e0e0; flex-shrink: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div class="gal-input-title" style="margin: 0; font-size: 1.4rem;">
                <span><i class="fa-solid fa-folder-open"></i> 资源管理器</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <button class="gal-action-btn" id="gal-asset-export" title="导出为ZIP包" style="padding: 6px 12px; font-size: 0.9rem;">
                  <i class="fa-solid fa-file-export"></i> 导出
                </button>
                <button class="gal-action-btn" id="gal-asset-export-remote" title="导出远程资源包(含JSON)" style="padding: 6px 12px; font-size: 0.9rem; background: #6f42c1; color: #fff; border-color: #6f42c1;">
                  <i class="fa-solid fa-cloud-upload"></i> 远程包
                </button>

                <!-- 导入下拉菜单 -->
                <div class="gal-import-dropdown" style="position: relative;">
                    <button class="gal-action-btn" id="gal-import-dropdown-btn" title="导入资源" style="padding: 6px 12px; font-size: 0.9rem; background: #28a745; color: #fff; border-color: #28a745;">
                    <i class="fa-solid fa-file-import"></i> 导入 <i class="fa-solid fa-caret-down" style="margin-left: 4px;"></i>
                    </button>
                    <div class="gal-import-menu" id="gal-import-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: #fff; border: 2px solid #333; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000; min-width: 200px; overflow: hidden;">
                    <div class="gal-import-item" data-action="import-local-zip" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                        <i class="fa-solid fa-file-zipper" style="width: 20px; color: #f39c12;"></i>
                        <span>本地压缩包导入</span>
                    </div>
                    <div class="gal-import-item" data-action="import-remote-zip" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                        <i class="fa-solid fa-cloud-arrow-down" style="width: 20px; color: #3498db;"></i>
                        <span>远程压缩包导入</span>
                    </div>
                    <div class="gal-import-item" data-action="import-json" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; border-bottom: 1px solid #eee; transition: background 0.2s; color: #333;">
                        <i class="fa-solid fa-link" style="width: 20px; color: #9b59b6;"></i>
                        <span>导入远程链接JSON</span>
                    </div>
                    <div class="gal-import-item" data-action="import-github" style="padding: 10px 15px; cursor: pointer; display: flex; align-items: center; gap: 10px; transition: background 0.2s; color: #333;">
                        <i class="fa-brands fa-github" style="width: 20px; color: #333;"></i>
                        <span>从GitHub导入</span>
                    </div>
                    </div>
                </div>
              </div>
            </div>
            <!-- 隐藏的文件输入 -->
            <input type="file" id="gal-asset-import-zip-input" accept=".zip" style="display: none;">
            <input type="file" id="gal-asset-import-input" multiple webkitdirectory style="display: none;">
            <input type="file" id="gal-asset-import-json-input" accept=".json" style="display: none;">
          </div>

          <!-- Tab 标签 -->
          <div class="gal-tab-header" style="display: flex; border-bottom: 2px solid #e0e0e0; padding: 0 25px; flex-shrink: 0;">
            <button class="gal-tab-btn ${activeTab === 'sprites' ? 'active' : ''}" data-tab="sprites">
              <i class="fa-solid fa-user"></i> 立绘管理
            </button>
            <button class="gal-tab-btn ${activeTab === 'backgrounds' ? 'active' : ''}" data-tab="backgrounds">
              <i class="fa-solid fa-image"></i> 背景管理
            </button>
            <button class="gal-tab-btn ${activeTab === 'custom' ? 'active' : ''}" data-tab="custom">
              <i class="fa-solid fa-code"></i> 自定义模块
            </button>
          </div>

          <!-- Tab 内容区 -->
          <div class="gal-tab-content" style="flex: 1; overflow-y: auto; padding: 20px 25px;">
            <!-- 立绘管理 Tab -->
            <div class="gal-tab-pane ${activeTab === 'sprites' ? 'active' : ''}" data-pane="sprites" style="${activeTab !== 'sprites' ? 'display: none;' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-weight: 700; color: ${THEME.dark};">
                  已保存 ${allSprites.length} 个立绘，共 ${charactersData.size} 个角色
                </span>
                <div style="display: flex; gap: 10px;">
                  <button class="gal-action-btn" id="gal-batch-upload-btn" style="padding: 8px 16px; background: #6f42c1; color: #fff; border: none;">
              <i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span>
            </button>
            <button class="gal-action-btn primary" id="gal-add-sprite-btn" style="padding: 8px 16px;">
              <i class="fa-solid fa-plus"></i> <span>添加立绘</span>
            </button>
            <button class="gal-action-btn" id="gal-manage-expressions-btn" style="padding: 8px 16px; background: #17a2b8; color: #fff; border: none;">
              <i class="fa-solid fa-face-smile"></i> <span>表情标签</span>
            </button>
                </div>
              </div>

              ${
                charactersData.size === 0
                  ? `
                <div style="text-align: center; padding: 40px; color: #999;">
                  <i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                  <p>暂无角色数据，请确保已加载数据库脚本或点击上方按钮添加</p>
                </div>
              `
                  : `
                <div class="gal-character-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px;">
                  ${Array.from(charactersData.entries())
                    .map(([charId, info]) => {
                      const sprites = info.sprites;
                      // 优先显示默认表情，否则显示第一个
                      const defaultSprite = sprites.find(s => s.expression === '默认') || sprites[0];
                      const avatarUrl = (
                        defaultSprite === null || defaultSprite === void 0 ? void 0 : defaultSprite.imageUrl
                      )
                        ? defaultSprite.imageUrl
                        : (defaultSprite === null || defaultSprite === void 0 ? void 0 : defaultSprite.imageBlob)
                          ? URL.createObjectURL(defaultSprite.imageBlob)
                          : '';
                      const typeLabel =
                        info.type && info.type !== '自定义'
                          ? `<span style="font-size: 0.7rem; background: ${THEME.accent}; color: ${THEME.dark}; padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${info.type}</span>`
                          : '';
                      return `
                    <div class="gal-character-card" data-char="${charId}" style="cursor: pointer; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); transition: all 0.2s;">
                      <div class="gal-character-avatar" style="aspect-ratio: 1 / 1; background: #f0f0f0; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                        ${avatarUrl ? `<img src="${avatarUrl}" alt="${charId}" style="width: 100%; height: 100%; object-fit: cover; object-position: top center;">` : `<i class="fa-solid fa-user" style="font-size: 3rem; color: #ccc;"></i>`}
                        ${sprites.length === 0 ? '<div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.5); color: #fff; font-size: 0.7rem; padding: 2px; text-align: center;">无立绘</div>' : ''}
                      </div>
                      <div style="padding: 10px; text-align: center;">
                        <div style="font-weight: 700; color: ${THEME.dark}; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; justify-content: center; align-items: center;">
                          ${charId}
                        </div>
                        <div style="margin-top: 4px; display: flex; justify-content: center; align-items: center; gap: 4px;">
                           ${typeLabel}
                           <span style="font-size: 0.75rem; color: #888;">${sprites.length} 个表情</span>
                        </div>
                      </div>
                    </div>
                  `;
                    })
                    .join('')}
                </div>
              `
              }
            </div>

            <!-- 背景管理 Tab -->
            <div class="gal-tab-pane" data-pane="backgrounds" style="display: none;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-weight: 700; color: ${THEME.dark};">
                  已保存 ${allBackgrounds.length} 个背景
                </span>
                <div style="display: flex; gap: 10px; align-items: center;">
                  <div class="gal-realtime-toggle-wrapper" title="开启后，当AI输出的场景在库中不存在时，将自动调用ComfyUI生成">
                       <span class="gal-realtime-label">实时生成</span>
                       <label class="gal-realtime-switch">
                          <input type="checkbox" id="gal-realtime-bg-gen" ${settings.realTimeBackgroundGen ? 'checked' : ''}>
                          <span class="gal-realtime-slider"></span>
                       </label>
                  </div>
                  <button class="gal-action-btn" id="gal-batch-bg-upload-btn" style="padding: 8px 16px; background: #6f42c1; color: #fff; border: none;">
                    <i class="fa-solid fa-cloud-arrow-up"></i> <span>批量上传</span>
                  </button>
                  <button class="gal-action-btn primary" id="gal-add-bg-btn" style="padding: 8px 16px;">
                    <i class="fa-solid fa-plus"></i> <span>添加背景</span>
                  </button>
                </div>
              </div>

              ${
                allBackgrounds.length === 0
                  ? `
                <div style="text-align: center; padding: 40px; color: #999;">
                  <i class="fa-solid fa-panorama" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                  <p>暂无背景，点击上方按钮添加</p>
                  <small style="color: #bbb;">背景图将根据 &lt;background scene="场景名" /&gt; 标签自动匹配</small>
                </div>
              `
                  : `
                <div class="gal-bg-grid">
                  ${allBackgrounds
                    .map(
                      bg => `
                    <div class="gal-bg-card" data-scene="${bg.sceneName}">
                      <div class="gal-bg-preview">
                        ${
                          bg.imageUrl
                            ? `<img src="${bg.imageUrl}" alt="${bg.sceneName}">`
                            : bg.imageBlob
                              ? `<img src="${URL.createObjectURL(bg.imageBlob)}" alt="${bg.sceneName}">`
                              : ''
                        }
                      </div>
                      <div class="gal-bg-label">${bg.sceneName}</div>
                      <button class="gal-bg-delete" data-scene="${bg.sceneName}" title="删除">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  `,
                    )
                    .join('')}
                </div>
              `
              }
            </div>

            <!-- 自定义模块 Tab -->
            <div class="gal-tab-pane" data-pane="custom" style="display: none;">
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px dashed #ddd; margin-bottom: 20px;">
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            <i class="fa-solid fa-location-dot" style="color: ${THEME.accent};"></i> 地点状态栏 - 自定义内容 HTML
                        </label>
                        <textarea id="gal-custom-location-html" placeholder="<div>自定义地点介绍...</div>"
                            style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${localStorage.getItem(CUSTOM_LOCATION_HTML_KEY) || ''}</textarea>
                    </div>
                    <div style="margin-bottom: 15px;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                            <i class="fa-solid fa-clock" style="color: ${THEME.accentSub};"></i> 时间状态栏 - 自定义内容 HTML
                        </label>
                        <textarea id="gal-custom-time-html" placeholder="<div>自定义时间介绍...</div>"
                            style="width: 100%; height: 120px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 0.9rem; color: #333; resize: vertical;">${localStorage.getItem(CUSTOM_TIME_HTML_KEY) || ''}</textarea>
                    </div>
                    <div style="text-align: right;">
                         <button class="gal-action-btn primary" id="gal-save-custom-html" style="padding: 8px 20px;">
                            <i class="fa-solid fa-save"></i> 保存配置
                         </button>
                    </div>
                    <script>
                        $('#gal-save-custom-html').on('click', function() {
                            const locHtml = $('#gal-custom-location-html').val();
                            const timeHtml = $('#gal-custom-time-html').val();
                            localStorage.setItem('${CUSTOM_LOCATION_HTML_KEY}', locHtml);
                            localStorage.setItem('${CUSTOM_TIME_HTML_KEY}', timeHtml);
                            showToast('自定义配置已保存');
                        });
                    </script>
                </div>
                <div style="padding: 15px; color: #666; font-size: 0.9rem; line-height: 1.6;">
                    <strong><i class="fa-solid fa-lightbulb"></i> 说明：</strong><br>
                    此处配置的 HTML 内容将在点击主界面的地点/时间状态栏时弹窗显示。<br>
                    支持标准 HTML 标签和内联样式。
                </div>
            </div>
          </div>

          <!-- 底部按钮 -->
          <div style="padding: 15px 25px; border-top: 1px solid #e0e0e0; flex-shrink: 0;">
            <button class="gal-action-btn" id="gal-asset-close" style="width: 100%; min-height: 44px;">
              <span>关闭</span>
            </button>
          </div>
        </div>
      </div>

      <style>
        .gal-tab-btn {
          padding: 12px 20px;
          border: none;
          background: transparent;
          font-size: 1rem;
          font-weight: 600;
          color: #666;
          cursor: pointer;
          border-bottom: 3px solid transparent;
          margin-bottom: -2px;
          transition: all 0.2s;
        }
        .gal-tab-btn:hover {
          color: ${THEME.accent};
        }
        .gal-tab-btn.active {
          color: ${THEME.accent};
          border-bottom-color: ${THEME.accent};
        }
        .gal-character-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 6px 16px rgba(0,0,0,0.15);
        }
        .gal-sprite-group {
          margin-bottom: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
        }
        .gal-sprite-group-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .gal-char-name {
          font-weight: 700;
          font-size: 1.1rem;
          color: ${THEME.dark};
        }
        .gal-sprite-count {
          font-size: 0.85rem;
          color: #888;
        }
        .gal-sprite-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
          gap: 12px;
        }
        .gal-sprite-card {
          position: relative;
          background: #fff;
          border-radius: 6px;
          overflow: hidden;
          box-shadow: 0 2px 6px rgba(0,0,0,0.1);
          transition: transform 0.2s;
        }
        .gal-sprite-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .gal-sprite-preview {
          aspect-ratio: 2 / 3;
          background: #eee;
          overflow: hidden;
        }
        .gal-sprite-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gal-sprite-label {
          padding: 6px;
          text-align: center;
          font-size: 0.75rem;
          font-weight: 600;
          color: ${THEME.dark};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gal-sprite-delete {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 24px;
          height: 24px;
          border: none;
          border-radius: 50%;
          background: rgba(255,0,85,0.9);
          color: #fff;
          font-size: 0.7rem;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .gal-sprite-card:hover .gal-sprite-delete {
          opacity: 1;
        }
        .gal-bg-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
          gap: 15px;
        }
        .gal-bg-card {
          position: relative;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          transition: transform 0.2s;
        }
        .gal-bg-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        }
        .gal-bg-preview {
          aspect-ratio: 16 / 9;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          overflow: hidden;
        }
        .gal-bg-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .gal-bg-label {
          padding: 10px;
          text-align: center;
          font-size: 0.9rem;
          font-weight: 600;
          color: ${THEME.dark};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .gal-bg-delete {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border: none;
          border-radius: 50%;
          background: rgba(255,0,85,0.9);
          color: #fff;
          font-size: 0.8rem;
          cursor: pointer;
          opacity: 0;
          transition: opacity 0.2s;
        }
        .gal-bg-card:hover .gal-bg-delete {
          opacity: 1;
        }

        /* 导入下拉菜单样式 */
        .gal-import-dropdown {
            position: relative;
            display: inline-block;
        }

        .gal-import-menu {
            animation: galDropdownFadeIn 0.15s ease;
        }

        @keyframes galDropdownFadeIn {
            from { opacity: 0; transform: translateY(-5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .gal-import-item:hover {
            background: #f0f7ff !important;
        }

        .gal-import-item:active {
            background: #e0efff !important;
        }

        /* 进度条遮罩层 */
        .gal-import-progress-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 100000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #fff;
        }

        .gal-import-progress-box {
            background: #2b2e38;
            padding: 30px 50px;
            border-radius: 12px;
            text-align: center;
            min-width: 300px;
        }

        .gal-import-progress-title {
            font-size: 1.2rem;
            font-weight: 700;
            margin-bottom: 15px;
            color: #00d2ff;
        }

        .gal-import-progress-bar-container {
            width: 100%;
            height: 8px;
            background: #444;
            border-radius: 4px;
            overflow: hidden;
            margin-bottom: 10px;
        }

        .gal-import-progress-bar {
            height: 100%;
            background: linear-gradient(90deg, #00d2ff, #00a8cc);
            width: 0%;
            transition: width 0.3s ease;
        }

        .gal-import-progress-text {
            font-size: 0.9rem;
            color: #aaa;
        }

        .gal-import-progress-details {
            font-size: 0.8rem;
            color: #888;
            margin-top: 8px;
            max-height: 60px;
            overflow-y: auto;
        }
      </style>
    `;
      $(topWindow.document.body).append(modalHtml);
      const $modal = $('#gal-asset-manager-modal');
      makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title').parent());
      // 根据 activeTab 参数切换到正确的标签页
      if (activeTab && activeTab !== 'sprites') {
        $modal.find('.gal-tab-btn').removeClass('active');
        $modal.find(`.gal-tab-btn[data-tab="${activeTab}"]`).addClass('active');
        $modal.find('.gal-tab-pane').hide();
        $modal.find(`.gal-tab-pane[data-pane="${activeTab}"]`).show();
      }
      // Tab 切换
      $modal.find('.gal-tab-btn').on('click', function () {
        const tab = $(this).data('tab');
        $modal.find('.gal-tab-btn').removeClass('active');
        $(this).addClass('active');
        $modal.find('.gal-tab-pane').hide();
        $modal.find(`.gal-tab-pane[data-pane="${tab}"]`).show();
      });
      // 关闭
      $('#gal-asset-close').on('click', () => $modal.remove());
      $modal.on('click', function (e) {
        if (e.target === this) $modal.remove();
      });
      // 实时生成开关
      $modal.find('#gal-realtime-bg-gen').on('change', async function () {
        settings.realTimeBackgroundGen = $(this).is(':checked');
        saveSettings();
        // 立即更新规则
        if (isEnabled) {
          await injectCOTToWorldbook();
        }
        showToast(settings.realTimeBackgroundGen ? '已开启实时背景生成（实验性）' : '已关闭实时背景生成');
      });

      // 批量上传按钮
      $('#gal-batch-upload-btn').on('click', () => {
        $modal.remove();
        showBatchUploadDialog(null, () => showAssetManagerModal('sprites'));
      });

      // 管理表情标签按钮
      $('#gal-manage-expressions-btn').on('click', () => {
        $modal.remove();
        showCustomExpressionManager(() => showAssetManagerModal('sprites'));
      });
      // 添加立绘
      $('#gal-add-sprite-btn').on('click', () => {
        $modal.remove();
        showSpriteUploadDialog('', '默认', () => showAssetManagerModal('sprites'));
      });
      // 添加背景
      $('#gal-add-bg-btn').on('click', () => {
        $modal.remove();
        showBackgroundUploadDialog(() => showAssetManagerModal('backgrounds'));
      });
      // 批量添加背景
      $('#gal-batch-bg-upload-btn').on('click', () => {
        $modal.remove();
        showBatchBackgroundUploadDialog(() => showAssetManagerModal('backgrounds'));
      });
      // 点击角色卡片打开该角色的立绘编辑弹窗
      $modal.find('.gal-character-card').on('click', function () {
        const charId = $(this).data('char');
        $modal.remove();
        showCharacterSpritesModal(charId);
      });
      // 删除背景
      $modal.find('.gal-bg-delete').on('click', function (e) {
        return __awaiter(this, void 0, void 0, function* () {
          e.stopPropagation();
          const scene = $(e.currentTarget).attr('data-scene');
          if (confirm(`确定删除背景「${scene}」吗？`)) {
            yield deleteBackground(scene);
            showToast(`已删除背景: ${scene}`);
            // 自动更新世界书中的场景列表
            if (isEnabled) {
              injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
            }
            $modal.remove();
            showAssetManagerModal('backgrounds'); // 刷新，保持在背景标签页
          }
        });
      });
      // 导出按钮
      $('#gal-asset-export').on('click', () => AssetIO.exportAllAssets());
      // 远程包导出按钮
      $('#gal-asset-export-remote').on('click', () => {
        const input = prompt(
          '请输入 GitHub 仓库信息 (格式: 用户名/仓库名) 或 完整URL前缀\n\n如果输入 用户名/仓库名 (如 Baibai/GalgamePlugin)，程序将自动生成 jsDelivr CDN 加速链接。\n\n也可以直接输入完整的 URL 前缀。',
        );
        if (!input) return;
        let baseUrl = input.trim();
        // 检测是否为 user/repo 格式 (不含 http 且包含一个斜杠)
        if (!baseUrl.startsWith('http') && baseUrl.indexOf('/') > 0 && baseUrl.split('/').length === 2) {
          // 是 GitHub 简写格式
          const branch = prompt('请输入分支名或版本号 (例如 main, master, v1.0):', 'main');
          if (!branch) return;
          const cleanRepo = baseUrl.replace('.git', '');
          // 构建 jsDelivr 链接: https://cdn.jsdelivr.net/gh/user/repo@branch/
          baseUrl = `https://cdn.jsdelivr.net/gh/${cleanRepo}@${branch}/`;
          if (!confirm(`确认生成以下 CDN 链接前缀的配置吗？\n${baseUrl}`)) {
            return;
          }
        }
        AssetIO.exportAllAssets(baseUrl);
      });
      // ========== 导入下拉菜单逻辑 ==========

      // 切换下拉菜单显示
      $('#gal-import-dropdown-btn').on('click', function (e) {
        e.stopPropagation();
        const $menu = $('#gal-import-menu');
        $menu.toggle();
      });

      // 点击页面其他区域关闭下拉菜单
      $(topWindow.document).on('click.galImportMenu', function (e) {
        if (!$(e.target).closest('.gal-import-dropdown').length) {
          $('#gal-import-menu').hide();
        }
      });

      // 下拉菜单项点击事件
      $modal.find('.gal-import-item').on('click', function () {
        const action = $(this).data('action');
        $('#gal-import-menu').hide(); // 关闭菜单

        switch (action) {
          case 'import-local-zip':
            $('#gal-asset-import-zip-input').click();
            break;
          case 'import-remote-zip':
            showRemoteZipImportDialog();
            break;
          case 'import-json':
            $('#gal-asset-import-json-input').click();
            break;
          case 'import-github':
            handleGitHubImport();
            break;
        }
      });

      // 本地ZIP文件选择处理
      $('#gal-asset-import-zip-input').on('change', function () {
        return __awaiter(this, void 0, void 0, function* () {
          const file = this.files[0];
          if (!file) return;

          // 验证文件大小 (5GB = 5 * 1024 * 1024 * 1024 bytes)
          const MAX_SIZE = 5 * 1024 * 1024 * 1024;
          if (file.size > MAX_SIZE) {
            showImportError([
              '文件大小超过限制',
              `当前文件: ${(file.size / 1024 / 1024 / 1024).toFixed(2)} GB`,
              '最大允许: 5 GB',
            ]);
            $(this).val('');
            return;
          }

          yield importFromZipFile(file);
          $(this).val('');
          $modal.remove();
          showAssetManagerModal(activeTab);
        });
      });

      // GitHub 导入处理函数
      function handleGitHubImport() {
        return __awaiter(this, void 0, void 0, function* () {
          const url = prompt(
            '请输入 GitHub 仓库地址 (例如: user/repo 或 https://github.com/user/repo/tree/main/path):',
          );
          if (url) {
            const success = yield AssetIO.importFromGitHub(url.trim());
            if (success) {
              $modal.remove();
              showAssetManagerModal(activeTab);
            }
          }
        });
      }

      // JSON 导入文件变更
      $('#gal-asset-import-json-input').on('change', function () {
        return __awaiter(this, void 0, void 0, function* () {
          if (this.files.length > 0) {
            yield importAssetsFromJson(this.files[0]);
            $modal.remove();
            showAssetManagerModal(activeTab); // 刷新
            // 清空 input
            $(this).val('');
          }
        });
      });

      // 模态框关闭时清理事件
      $modal.on('remove', function () {
        $(topWindow.document).off('click.galImportMenu');
      });
    });
  }
  /**
   * 角色立绘编辑弹窗 - 显示指定角色的所有立绘，支持编辑和删除
   * @param {string} characterId - 角色ID
   */
  function showCharacterSpritesModal(characterId) {
    return __awaiter(this, void 0, void 0, function* () {
      // 获取该角色的所有立绘
      const allSprites = yield getAllSprites();
      const characterSpritesData = allSprites.filter(s => s.characterId === characterId);
      const modalHtml = `
      <div class="gal-input-modal" id="gal-character-sprites-modal">
        <div class="gal-input-box" style="max-width: 800px; width: 95%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
          <!-- 标题栏 -->
          <div style="padding: 20px 25px 15px; border-bottom: 1px solid #e0e0e0; flex-shrink: 0;">
            <div class="gal-input-title" style="margin: 0; font-size: 1.4rem;">
              <span><i class="fa-solid fa-user"></i> ${characterId} 的立绘管理</span>
            </div>
          </div>

          <!-- TTS音色绑定区域 -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0 25px; margin-top: 15px; padding: 15px; border-radius: 8px; color: #fff;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
              <i class="fa-solid fa-microphone-lines" style="font-size: 1.2rem;"></i>
              <span style="font-weight: 600;">TTS配音音色绑定</span>
            </div>
            <div style="display: flex; gap: 10px;">
              <select id="gal-char-tts-voice-select"
                      style="flex: 1; padding: 8px 12px; border: none; border-radius: 4px; font-size: 0.95rem; cursor: pointer;">
                <option value="">-- 不绑定音色 --</option>
                ${TTS_VOICE_LIST.map(v => {
                  const boundVoice = getCharacterTTSVoice(characterId);
                  return `<option value="${v.name}" ${boundVoice === v.name ? 'selected' : ''}>${v.name} (${v.desc})</option>`;
                }).join('')}
              </select>
              <button class="gal-action-btn" id="gal-char-tts-save-btn" style="padding: 8px 16px; font-size: 0.9rem; background: rgba(255,255,255,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.3); white-space: nowrap;">
                <i class="fa-solid fa-check"></i> 保存
              </button>
            </div>
            <small style="opacity: 0.9; margin-top: 8px; display: block; font-size: 0.8rem;">
              <i class="fa-solid fa-circle-info"></i> 绑定后AI会自动为该角色使用此音色配音
            </small>
          </div>

          <!-- 立绘列表 -->
          <div style="flex: 1; overflow-y: auto; padding: 20px 25px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <span style="font-weight: 700; color: ${THEME.dark};">
                共 ${characterSpritesData.length} 个表情
              </span>
              <button class="gal-action-btn primary" id="gal-char-add-sprite-btn" style="padding: 8px 16px;">
                <i class="fa-solid fa-plus"></i> <span>添加表情</span>
              </button>
            </div>

            ${
              characterSpritesData.length === 0
                ? `
              <div style="text-align: center; padding: 40px; color: #999;">
                <i class="fa-solid fa-images" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>该角色暂无立绘，点击上方按钮添加</p>
              </div>
            `
                : `
              <div class="gal-sprite-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px;">
                ${characterSpritesData
                  .map(
                    s => `
                  <div class="gal-sprite-card" data-char="${s.characterId}" data-expr="${s.expression}" style="position: relative; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.1); transition: transform 0.2s; cursor: pointer;">
                    <div class="gal-sprite-preview" style="aspect-ratio: 2 / 3; background: #eee; overflow: hidden;">
                      ${
                        s.imageUrl
                          ? `<img src="${s.imageUrl}" alt="${s.expression}" style="width: 100%; height: 100%; object-fit: cover;">`
                          : s.imageBlob
                            ? `<img src="${URL.createObjectURL(s.imageBlob)}" alt="${s.expression}" style="width: 100%; height: 100%; object-fit: cover;">`
                            : ''
                      }
                    </div>
                    <div class="gal-sprite-label" style="padding: 8px; text-align: center; font-size: 0.8rem; font-weight: 600; color: ${THEME.dark}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${s.expression}</div>
                    <button class="gal-sprite-delete" data-char="${s.characterId}" data-expr="${s.expression}" title="删除" style="position: absolute; top: 4px; right: 4px; width: 24px; height: 24px; border: none; border-radius: 50%; background: rgba(255,0,85,0.9); color: #fff; font-size: 0.7rem; cursor: pointer;">
                      <i class="fa-solid fa-trash"></i>
                    </button>
                  </div>
                `,
                  )
                  .join('')}
              </div>
            `
            }
          </div>

          <!-- 底部按钮 -->
          <div style="padding: 15px 25px; border-top: 1px solid #e0e0e0; flex-shrink: 0; display: flex; gap: 10px;">
            <button class="gal-action-btn" id="gal-char-sprites-back" style="flex: 1; min-height: 44px;">
              <i class="fa-solid fa-arrow-left"></i> <span>返回</span>
            </button>
            <button class="gal-action-btn" id="gal-char-sprites-close" style="flex: 1; min-height: 44px;">
              <span>关闭</span>
            </button>
          </div>
        </div>
      </div>

      <style>
        #gal-character-sprites-modal .gal-sprite-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        #gal-character-sprites-modal .gal-sprite-delete {
          opacity: 0;
          transition: opacity 0.2s;
        }
        #gal-character-sprites-modal .gal-sprite-card:hover .gal-sprite-delete {
          opacity: 1;
        }
      </style>
    `;
      $(topWindow.document.body).append(modalHtml);
      const $modal = $('#gal-character-sprites-modal');
      makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title').parent());
      // 统一关闭处理
      const handleClose = () => {
        $modal.remove();
        if (typeof onCloseCallback === 'function') {
          try {
            onCloseCallback();
          } catch (e) {
            console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
          }
        }
      };
      // 关闭
      $('#gal-char-sprites-close').on('click', handleClose);
      $modal.on('click', function (e) {
        if (e.target === this) handleClose();
      });
      // 返回资源管理器
      $('#gal-char-sprites-back').on('click', () => {
        $modal.remove();
        showAssetManagerModal();
      });
      // 添加表情
      $('#gal-char-add-sprite-btn').on('click', () => {
        $modal.remove();
        showSpriteUploadDialog(characterId, '默认', () => showCharacterSpritesModal(characterId));
      });
      // TTS音色保存按钮
      $('#gal-char-tts-save-btn').on('click', () => {
        const voiceName = $('#gal-char-tts-voice-select').val();
        setCharacterTTSVoice(characterId, voiceName);
        if (voiceName) {
          showToast(`已绑定: ${characterId} → ${voiceName}`);
        } else {
          showToast(`已清除 ${characterId} 的音色绑定`);
        }
        // 刷新界面显示
        $modal.remove();
        showCharacterSpritesModal(characterId);
      });
      // 点击立绘卡片编辑
      $modal.find('.gal-sprite-card').on('click', function (e) {
        if ($(e.target).closest('.gal-sprite-delete').length) return; // 忽略删除按钮点击
        const charId = $(this).data('char');
        const expr = $(this).data('expr');
        $modal.remove();
        showSpriteUploadDialog(charId, expr, () => showCharacterSpritesModal(charId));
      });
      // 删除立绘
      $modal.find('.gal-sprite-delete').on('click', function (e) {
        e.stopPropagation();
        const $btn = $(this);
        const charId = $btn.attr('data-char');
        const expr = $btn.attr('data-expr');
        return __awaiter(void 0, void 0, void 0, function* () {
          if (confirm(`确定删除 ${charId} 的「${expr}」表情吗？`)) {
            yield deleteSprite(charId, expr);
            showToast(`已删除: ${charId} - ${expr}`);
            $modal.remove();
            showCharacterSpritesModal(charId); // 刷新
          }
        });
      });
    });
  }
  // 获取所有立绘
  function getAllSprites() {
    return __awaiter(this, void 0, void 0, function* () {
      if (!db) yield initDB();
      return new Promise(resolve => {
        const transaction = db.transaction([STORE_SPRITES], 'readonly');
        const store = transaction.objectStore(STORE_SPRITES);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => resolve([]);
      });
    });
  }
  function showToast(message) {
    const $existing = $('.gal-toast');
    if ($existing.length) $existing.remove();
    const $toast = $(`<div class="gal-toast"><span>${message}</span></div>`);
    $(topWindow.document.body).append($toast);
    setTimeout(() => $toast.fadeOut(300, () => $toast.remove()), 2500);
  }
  // ============================================
  // 消息监听与自动渲染
  // ============================================
  const messageContentDebounceTimers = new Map();
  function setupMessageObserver() {
    // 初始化 BGM
    BGMManager.init();
    TTSManager.init();
    const chatContainer = topWindow.document.querySelector('#chat');
    if (!chatContainer) {
      console.warn(`[${SCRIPT_NAME}] 未找到 #chat 容器`);
      return;
    }
    // 主Observer：监听新消息添加
    const chatObserver = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          var _a;
          if (node.nodeType === 1 && ((_a = node.classList) === null || _a === void 0 ? void 0 : _a.contains('mes'))) {
            // 如果开启了Galgame模式且设置了隐藏其他楼层，立即隐藏新消息以防闪烁
            if (isEnabled && settings.hideOtherFloors) {
              node.classList.add('gal-hidden');
            }
            // 延迟处理，确保消息内容已加载
            setTimeout(() => {
              processNewMessage(node);
              injectGalgameButton(node);
            }, 200);
            // 为新消息设置内容变化监听
            setupMessageContentObserver(node);
          }
        });
      });
    });
    chatObserver.observe(chatContainer, { childList: true, subtree: false });
    // 为已存在的消息也设置内容监听并注入按钮
    chatContainer.querySelectorAll('.mes').forEach(mes => {
      setupMessageContentObserver(mes);
      injectGalgameButton(mes);
    });
    console.log(`[${SCRIPT_NAME}] 消息监听器已启动`);
  }
  // 监听单个消息的内容变化（用于流式输出完成后触发渲染）
  // ★ 性能优化：使用 requestAnimationFrame + 更长防抖时间
  function setupMessageContentObserver(mesNode) {
    const mesText = mesNode.querySelector('.mes_text');
    if (!mesText) return;
    const mesId = mesNode.getAttribute('mesid');
    if (!mesId) return;
    // 避免重复设置Observer
    if (mesNode.hasAttribute('data-gal-observer')) return;
    mesNode.setAttribute('data-gal-observer', 'true');

    let rafId = null;
    let debounceTimer = null;

    const contentObserver = new MutationObserver(() => {
      // ★ 性能优化：使用 requestAnimationFrame 节流
      if (rafId) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;

        // 使用防抖机制，避免频繁触发
        if (debounceTimer) {
          clearTimeout(debounceTimer);
        }

        debounceTimer = setTimeout(() => {
          debounceTimer = null;
          messageContentDebounceTimers.delete(mesId);
          // 消息内容变化后重新处理
          if (isEnabled) {
            processNewMessage(mesNode);
          }
        }, 200); // ★ 性能优化：200ms 防抖（原50ms），减少频繁解析

        messageContentDebounceTimers.set(mesId, debounceTimer);
      });
    });
    contentObserver.observe(mesText, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
  // HTML 解码
  function decodeHtml(html) {
    const txt = document.createElement('textarea');
    txt.innerHTML = html;
    return txt.value;
  }
  /**
   * 从 SillyTavern 的聊天数组中获取原始消息内容
   * 这样可以避免浏览器 HTML 解析器删除自定义标签（如 <background>）
   * @param {string|number} mesId 消息 ID
   * @returns {string|null} 原始消息内容
   */
  function getRawMessageContent(mesId) {
    var _a, _b;
    try {
      const ctx =
        (_b = (_a = topWindow.SillyTavern) === null || _a === void 0 ? void 0 : _a.getContext) === null || _b === void 0
          ? void 0
          : _b.call(_a);
      if (ctx && ctx.chat && Array.isArray(ctx.chat)) {
        const messageIndex = parseInt(mesId, 10);
        if (!isNaN(messageIndex) && ctx.chat[messageIndex]) {
          const rawContent = ctx.chat[messageIndex].mes;
          if (rawContent) {
            // console.log(`[${SCRIPT_NAME}] [DEBUG] 从 chat 数组获取消息 ${mesId} 的原始内容`);
            return rawContent;
          }
        }
      }
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 获取原始消息失败:`, e);
    }
    return null;
  }
  async function handleRealTimeBackgroundGeneration(sceneName, tags) {
    if (!settings.realTimeBackgroundGen) return;
    if (BGMManager.generatingScenes.has(sceneName)) return;

    // 检查场景是否已存在
    try {
      const backgrounds = await getAllBackgrounds();
      if (backgrounds.some(bg => bg.sceneName === sceneName)) {
        return; // 已存在，无需生成
      }
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 检查背景存在失败:`, e);
    }

    console.log(`[${SCRIPT_NAME}] 触发实时背景生成: ${sceneName}, Tags: ${tags}`);
    BGMManager.generatingScenes.add(sceneName);
    showToast(`正在生成新场景: ${sceneName}...`);

    const $bgLayer = $('#gal-global-overlay .gal-layer-bg');
    if ($bgLayer.length) {
      $bgLayer.addClass('generating-bg').removeClass('has-bg').css('background-image', '');
      if ($bgLayer.find('.gal-gen-indicator').length === 0) {
        $bgLayer.append(`
                     <div class="gal-gen-indicator">
                         <div class="gal-gen-rings">
                             <i class="fa-solid fa-paintbrush gal-gen-icon"></i>
                         </div>
                         <div class="gal-gen-text">
                             <span class="gal-gen-title">GENERATING</span>
                             <span class="gal-gen-scene">${sceneName}</span>
                             <div class="gal-gen-dots">
                                 <span class="gal-gen-dot"></span>
                                 <span class="gal-gen-dot"></span>
                                 <span class="gal-gen-dot"></span>
                             </div>
                         </div>
                     </div>
                 `);
      }
    }

    // 异步执行生成，不阻塞UI
    (async () => {
      try {
        // 获取工作流配置
        const workflowId = settings.comfyui.defaultBgWorkflow;
        const allWorkflows = getComfyWorkflows();
        let targetWorkflow = null;

        if (workflowId && allWorkflows[workflowId]) {
          targetWorkflow = allWorkflows[workflowId];
        } else if (workflowId) {
          // 尝试按名称查找
          targetWorkflow = Object.values(allWorkflows).find(w => w.name === workflowId);
        } else {
          // 默认查找 default_bg
          targetWorkflow = Object.values(allWorkflows).find(w => w.name === 'default_bg');
        }

        if (!targetWorkflow || !targetWorkflow.json) {
          throw new Error(`未找到默认背景生成工作流: ${workflowId || 'default_bg'}。请在设置-ComfyUI中配置。`);
        }

        // 构造提示词: 加上一些质量词
        const positive = `${tags}, (high quality, masterpiece, best quality, 4k, 8k:1.2), no humans`;
        const negative = settings.comfyui.negativePrompt || 'nsfw, lowres, bad anatomy, bad hands, text, error';
        const seed = Math.floor(Math.random() * 10000000000);

        const blob = await ComfyUIAPI.generate(targetWorkflow.json, positive, negative, seed);

        if (blob) {
          // 保存背景
          // 构造 File 对象
          const file = new File([blob], `${sceneName}.png`, { type: 'image/png' });
          await saveBackgroundsBatch([{ sceneName: sceneName, imageBlob: blob }]);

          const newUrl = URL.createObjectURL(blob);
          if (typeof sceneBackgrounds !== 'undefined') {
            console.log(
              `[${SCRIPT_NAME}] [DEBUG] 实时生成后手动更新缓存: "${sceneName}" URL: ${newUrl.substring(0, 50)}...`,
            );
            sceneBackgrounds.set(sceneName, newUrl);
            console.log(
              `[${SCRIPT_NAME}] [DEBUG] Cache check after set: has("${sceneName}") = ${sceneBackgrounds.has(sceneName)}`,
            );
          }

          console.log(`[${SCRIPT_NAME}] 场景生成并保存成功: ${sceneName}`);
          showToast(`场景「${sceneName}」生成完成！`);

          const $bgLayer = $('#gal-global-overlay .gal-layer-bg');
          $bgLayer.find('.gal-gen-indicator').remove();

          // 刷新世界书（如果需要）
          if (isEnabled) {
            injectCOTToWorldbook();
          }

          // 如果当前正处于该场景（显示为生成中），则尝试刷新背景显示
          // 这需要 updateGlobalOverlayContent 或 renderGalgameUI 能够感知
          // 简单的做法是重新处理当前最后一条消息
          const $lastMes = $('#chat > .mes').last();
          console.log(`[${SCRIPT_NAME}] [DEBUG] 尝试刷新UI. LastMes ID: ${$lastMes.attr('mesid')}`);
          if ($lastMes.length) {
            const mesId = $lastMes.attr('mesid');
            const state = messageSegmentState.get(String(mesId));
            // console.log(`[${SCRIPT_NAME}] [DEBUG] State found:`, !!state);
            if (
              state &&
              state.parsedContent &&
              state.parsedContent.currentBackground &&
              state.parsedContent.currentBackground.scene === sceneName
            ) {
              // ★ 关键修复: 强制重置当前场景记录，否则 applySceneTint 会因为 scene 没变而直接 return
              if (typeof SpriteManager !== 'undefined') {
                SpriteManager.currentScene = null;
              }
              console.log(`[${SCRIPT_NAME}] [DEBUG] 强制刷新UI: ${sceneName}`);

              // 强制刷新
              updateGlobalOverlayContent(mesId, state.parsedContent);
            } else {
              // console.log(`[${SCRIPT_NAME}] [DEBUG] 场景不匹配或状态为空...`);
            }
          }
        } else {
          throw new Error('生成的图片数据为空');
        }
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 实时背景生成失败:`, e);
        showToast(`场景「${sceneName}」生成失败`);
      } finally {
        BGMManager.generatingScenes.delete(sceneName);
      }
    })();
  }

  function processNewMessage(mesNode) {
    // 注入开启按钮 (无论是否开启模式)
    if (typeof injectGalgameButton === 'function') {
      injectGalgameButton(mesNode);
    }
    if (!isEnabled) return;
    const $mes = $(mesNode);
    const isUser = $mes.attr('is_user') === 'true';
    if (isUser) return; // 只处理AI消息
    const mesId = $mes.attr('mesid');
    // ★ 优先从 SillyTavern chat 数组获取原始消息（保留自定义标签）
    let contentToProcess = getRawMessageContent(mesId);
    // 回退到 DOM 内容
    if (!contentToProcess) {
      const $mesText = $mes.find('.mes_text');
      const html = $mesText.html();
      if (!html) return;
      contentToProcess = decodeHtml(html);
      // console.log(`[${SCRIPT_NAME}] [DEBUG] 回退到 DOM 内容`);
    }
    // 检查是否包含 Galgame 格式标签 - 使用预编译正则
    const hasGalTags = RE_GAL_TAGS.test(contentToProcess);
    // 如果开启了智能检测，且没有标签，则直接忽略
    if (settings.smartDetection && !hasGalTags) return;
    // ★ 流式输出检查：如果没有完整的 </p> 标签，显示生成中提示 - 使用预编译正则
    const hasClosedP = RE_CLOSED_P.test(contentToProcess);
    if (!hasClosedP) {
      console.log(`[${SCRIPT_NAME}] 流式输出中，等待完整内容...`);
      // 构造"生成中"的临时解析结果
      const loadingParsed = {
        segments: [
          {
            type: 'narration',
            speaker: null,
            text: '生成中...',
            expression: null,
          },
        ],
        currentBackground: null,
        bgm: null,
        options: [],
      };
      // 检查是否是最后一条AI消息
      const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
      if (isLastAi) {
        updateGlobalOverlayContent(mesId, loadingParsed);
        showGlobalOverlay();
        // ★ 流式输出时保持选项按钮状态
        if (pendingOptions && pendingOptions.length > 0) {
          $('.gal-game-container .gal-pending-choices-btn').addClass('show');
        }
      }
      return;
    }
    // 解析内容
    let parsed = parseGalgameContent(contentToProcess);

    // ★ 实时背景生成处理
    if (settings.realTimeBackgroundGen && parsed.currentBackground && parsed.currentBackground.generationTags) {
      console.log(`[${SCRIPT_NAME}] [DEBUG] 触发 handleRealTimeBackgroundGeneration`);
      handleRealTimeBackgroundGeneration(parsed.currentBackground.scene, parsed.currentBackground.generationTags);
    }

    console.log(`[${SCRIPT_NAME}] [DEBUG] processNewMessage 解析完成. Segments: ${parsed.segments.length}`);

    // 如果未解析出段落（即没有Galgame格式），但智能检测关闭，尝试强制解析
    if (parsed.segments.length === 0) {
      if (!settings.smartDetection && contentToProcess && contentToProcess.trim().length > 0) {
        console.log(`[${SCRIPT_NAME}] 智能检测关闭，尝试以普通模式解析`);
        // 构造一个简单的 parsed 对象，将整个内容作为一段旁白
        parsed = {
          segments: [
            {
              type: 'narration',
              speaker: null,
              text: contentToProcess,
              expression: null,
            },
          ],
          currentBackground: null,
          bgm: null,
          options: [],
        };
      } else {
        return;
      }
    }
    // 检查是否需要重置状态（如重新生成）
    let state = messageSegmentState.get(String(mesId));
    if (!state) {
      state = { currentIndex: 0, segments: parsed.segments, parsedContent: parsed };
      messageSegmentState.set(String(mesId), state);
      console.log(`[${SCRIPT_NAME}] 消息 ${mesId} 初始化状态`);
    } else {
      const oldSegmentsCount = state.segments.length;
      state.segments = parsed.segments;
      state.parsedContent = parsed;
      // 关键修复：不要轻易限制 currentIndex。
      // 在流式生成中，currentIndex 可能会因为 parsed.segments.length 暂时变小（解析波动）而被强制拉回。
      // 我们只在确实超过范围时才限制。
      if (state.currentIndex >= parsed.segments.length) {
        state.currentIndex = parsed.segments.length - 1;
      }
      // state.currentIndex = Math.min(state.currentIndex, parsed.segments.length - 1);
      console.log(`[${SCRIPT_NAME}] 消息 ${mesId} 更新: ${oldSegmentsCount} -> ${parsed.segments.length} 段`);
    }
    // 检查是否是最后一条AI消息
    // 防止旧消息的 MutationObserver 触发导致界面切回旧内容
    const isLastAi = $mes.nextAll('.mes[is_user!="true"]').length === 0;
    if (isLastAi) {
      // 更新全局覆盖层内容
      updateGlobalOverlayContent(mesId, parsed);
      showGlobalOverlay();
      // ★ 确保在显示后强制应用最新设置 (解决刷新后位置/间距重置问题)
      // 使用 setTimeout 确保 DOM 渲染后再应用样式
      requestAnimationFrame(() => {
        applySettingsToUI();
      });
      // BGM处理 (新增)
      if (parsed.bgm && parsed.bgm.keyword) {
        BGMManager.play(parsed.bgm.keyword);
      }
      // 渲染 BGM 下拉条 (如果还没渲染)
      renderBGMWidget();
      // 独立处理隐藏楼层（性能优化）
      if (hideOtherFloors) {
        setTimeout(hideNonLastFloors, 100);
      }
    } else {
      console.log(`[${SCRIPT_NAME}] 消息 ${mesId} 不是最后一条AI消息，跳过全局UI更新`);
    }
  }
  // 显示生成中状态
  function showGeneratingStatus($container, text) {
    let $status = $container.find('.gal-generating-status');
    if (!$status.length) {
      $status = $(`<div class="gal-generating-status"></div>`);
      $container.find('.gal-dialog-layer').prepend($status);
    }
    $status.text(text).addClass('show');
    setTimeout(() => $status.removeClass('show'), 2000);
  }
  function refreshGalgameViews() {
    $('.gal-message-container').each(function () {
      const mesId = $(this).data('mes-id');
      const $mes = $(`.mes[mesid="${mesId}"]`);
      const $mesText = $mes.find('.mes_text');
      const originalHtml = $mesText.attr('data-gal-original');
      if (originalHtml) {
        // 同样需要解码，因为 originalHtml 可能是转义过的
        const decodedHtml = decodeHtml(originalHtml);
        const parsed = parseGalgameContent(decodedHtml);
        if (parsed.segments.length > 0) {
          renderGalgameMessage(mesId, parsed);
        }
      }
    });
  }
  // ============================================
  // 世界书注入功能
  // ============================================
  /**
   * 检查世界书是否存在
   */
  function checkWorldbookExists(worldbookName) {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        const names = getWorldbookNames();
        return names.includes(worldbookName);
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 检查世界书失败:`, e);
        return false;
      }
    });
  }
  /**
   * 注入COT到世界书
   * 如果世界书不存在则创建，如果条目不存在则添加
   */
  function injectCOTToWorldbook() {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        // 动态生成COT模板（包含最新的场景列表）
        const cotTemplate = yield generateCOTTemplate();
        const exists = yield checkWorldbookExists(WORLDBOOK_NAME);
        if (!exists) {
          // 创建新世界书并添加条目
          console.log(`[${SCRIPT_NAME}] 创建世界书: ${WORLDBOOK_NAME}`);
          const cotEntry = {
            name: COT_ENTRY_NAME,
            enabled: true,
            content: cotTemplate,
            strategy: {
              type: 'constant', // 蓝灯 - 常驻
              keys: [],
              keys_secondary: { logic: 'and_any', keys: [] },
              scan_depth: 'same_as_global',
            },
            position: {
              type: 'at_depth', // D0 系统
              role: 'system',
              depth: 0,
              order: 100,
            },
            probability: 100,
            recursion: {
              prevent_incoming: false,
              prevent_outgoing: false,
              delay_until: null,
            },
            effect: {
              sticky: null,
              cooldown: null,
              delay: null,
            },
          };
          yield createOrReplaceWorldbook(WORLDBOOK_NAME, [cotEntry]);
          console.log(`[${SCRIPT_NAME}] 世界书创建成功`);
          showToast('已创建Galgame格式规范世界书');
        } else {
          // 世界书存在，检查并更新条目
          console.log(`[${SCRIPT_NAME}] 更新世界书: ${WORLDBOOK_NAME}`);
          let worldbook;
          try {
            worldbook = yield getWorldbook(WORLDBOOK_NAME);
          } catch (getError) {
            // 世界书已被删除但 getWorldbookNames 缓存未更新，重新创建
            console.log(`[${SCRIPT_NAME}] 世界书获取失败，可能已被删除，重新创建: ${WORLDBOOK_NAME}`);
            const cotEntry = {
              name: COT_ENTRY_NAME,
              enabled: true,
              content: cotTemplate,
              strategy: {
                type: 'constant',
                keys: [],
                keys_secondary: { logic: 'and_any', keys: [] },
                scan_depth: 'same_as_global',
              },
              position: {
                type: 'at_depth', // D0 系统
                role: 'system',
                depth: 0,
                order: 100,
              },
              probability: 100,
              recursion: {
                prevent_incoming: false,
                prevent_outgoing: false,
                delay_until: null,
              },
              effect: {
                sticky: null,
                cooldown: null,
                delay: null,
              },
            };
            yield createOrReplaceWorldbook(WORLDBOOK_NAME, [cotEntry]);
            console.log(`[${SCRIPT_NAME}] 世界书已重新创建`);
            showToast('已重新创建Galgame格式规范世界书');
            return true;
          }
          const existingEntry = worldbook.find(e => e.name === COT_ENTRY_NAME);
          if (existingEntry) {
            // 更新现有条目
            yield updateWorldbookWith(WORLDBOOK_NAME, entries => {
              return entries.map(entry => {
                if (entry.name === COT_ENTRY_NAME) {
                  return Object.assign(Object.assign({}, entry), { content: cotTemplate });
                }
                return entry;
              });
            });
            console.log(`[${SCRIPT_NAME}] 条目已更新`);
            showToast('Galgame格式规范已更新');
          } else {
            // 添加新条目
            const cotEntry = {
              name: COT_ENTRY_NAME,
              enabled: true,
              content: cotTemplate,
              strategy: {
                type: 'constant',
                keys: [],
                keys_secondary: { logic: 'and_any', keys: [] },
                scan_depth: 'same_as_global',
              },
              position: {
                type: 'at_depth', // D0 系统
                role: 'system',
                depth: 0,
                order: 100,
              },
              probability: 100,
              recursion: {
                prevent_incoming: false,
                prevent_outgoing: false,
                delay_until: null,
              },
              effect: {
                sticky: null,
                cooldown: null,
                delay: null,
              },
            };
            yield createWorldbookEntries(WORLDBOOK_NAME, [cotEntry]);
            console.log(`[${SCRIPT_NAME}] 条目已添加`);
            showToast('Galgame格式规范已添加到世界书');
          }
        }
        return true;
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 注入COT失败:`, e);
        return false;
      }
    });
  }
  /**
   * 全局开启世界书
   */
  function enableWorldbookGlobally() {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        const globalWorldbooks = getGlobalWorldbookNames();
        // 检查是否已全局开启
        if (globalWorldbooks.includes(WORLDBOOK_NAME)) {
          console.log(`[${SCRIPT_NAME}] 世界书已全局开启`);
          return true;
        }
        // 添加到全局世界书
        const newGlobal = [...globalWorldbooks, WORLDBOOK_NAME];
        yield rebindGlobalWorldbooks(newGlobal);
        console.log(`[${SCRIPT_NAME}] 世界书已全局开启`);
        return true;
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 全局开启世界书失败:`, e);
        return false;
      }
    });
  }
  /**
   * 全局关闭世界书
   */
  function disableWorldbookGlobally() {
    return __awaiter(this, void 0, void 0, function* () {
      try {
        const globalWorldbooks = getGlobalWorldbookNames();
        // 检查是否已开启
        if (!globalWorldbooks.includes(WORLDBOOK_NAME)) {
          console.log(`[${SCRIPT_NAME}] 世界书未开启，无需关闭`);
          return true;
        }
        // 从全局世界书移除
        const newGlobal = globalWorldbooks.filter(name => name !== WORLDBOOK_NAME);
        yield rebindGlobalWorldbooks(newGlobal);
        console.log(`[${SCRIPT_NAME}] 世界书已全局关闭`);
        return true;
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 全局关闭世界书失败:`, e);
        return false;
      }
    });
  }
  // ============================================
  // 选项面板 - 监控骰子系统并渲染到Galgame UI
  // ============================================
  /**
   * 创建或获取选项面板容器
   */
  function ensureChoicesLayer() {
    const targetDoc = topWindow.document;
    let $layer = $(targetDoc).find('#gal-layer-choices');
    if (!$layer.length) {
      const layerHtml = `
        <div id="gal-layer-choices">
          <div class="gal-choices-title"><span>请选择行动</span></div>
          <div class="gal-choices-container"></div>
          <div class="gal-choices-hint">点击空白处关闭</div>
        </div>
      `;
      $(targetDoc.body).append(layerHtml);
      $layer = $(targetDoc).find('#gal-layer-choices');
      // 点击空白处关闭（标记为用户主动关闭）
      $layer.on('click', function (e) {
        if (e.target === this) {
          hideGalgameChoices(true);
        }
      });
    }
    return $layer;
  }
  /**
   * 渲染选项到Galgame选项面板
   * @param {Array<{text: string, value: string}>} options 选项列表
   */
  function renderGalgameChoices(options) {
    if (!options || options.length === 0) {
      hideGalgameChoices(false);
      return;
    }
    // 保存当前选项用于提示按钮重新打开
    pendingOptions = options;
    // ★ 常驻显示：只要有选项，就显示按钮
    $('.gal-game-container .gal-pending-choices-btn').addClass('show');
    const $layer = ensureChoicesLayer();
    const $container = $layer.find('.gal-choices-container');
    // 清空并重新渲染选项
    $container.empty();
    options.forEach((opt, idx) => {
      const $card = $(`
        <div class="gal-choice-card" data-option-index="${idx}" data-option-value="${encodeURIComponent(opt.value)}">
          <span>${opt.text}</span>
        </div>
      `);
      $card.on('click', function (e) {
        e.stopPropagation();
        const value = decodeURIComponent($(this).data('option-value'));
        handleChoiceSelection(value);
      });
      $container.append($card);
    });
    // 显示面板
    $layer.addClass('active');
    galgameChoicesVisible = true;
    console.log(`[${SCRIPT_NAME}] 渲染 ${options.length} 个选项到Galgame选项面板`);
  }
  /**
   * 显示工具栏内的待选择提示按钮
   */
  function showPendingChoicesButton() {
    if (!pendingOptions || pendingOptions.length === 0) return;
    // 在所有Galgame容器的工具栏中显示按钮 -> 改为只在全局覆盖层显示，确保准确
    $('#gal-global-overlay .gal-pending-choices-btn').addClass('show');
    console.log(`[${SCRIPT_NAME}] 显示待选择提示按钮`);
  }
  /**
   * 隐藏工具栏内的待选择提示按钮
   */
  function hidePendingChoicesButton() {
    $('#gal-global-overlay .gal-pending-choices-btn').removeClass('show');
    // 注意：这里不要清空 pendingOptions，因为可能是只是暂时隐藏（虽然目前的逻辑是用户选了才隐藏）
    // 但按照“用户选择了”的逻辑，pendingOptions 确实应该清空
    pendingOptions = null;
    console.log(`[${SCRIPT_NAME}] 隐藏待选择提示按钮`);
  }
  /**
   * 隐藏Galgame选项面板
   * @param {boolean} userDismissed - 是否是用户主动关闭（点击空白处）
   */
  function hideGalgameChoices(userDismissed = false) {
    const targetDoc = topWindow.document;
    $(targetDoc).find('#gal-layer-choices').removeClass('active');
    galgameChoicesVisible = false;
    // 如果还有选项，确保按钮是显示的
    if (pendingOptions && pendingOptions.length > 0) {
      showPendingChoicesButton();
    }
  }
  /**
   * 处理选项选择
   * @param {string} optionValue 选中的选项值
   */
  function handleChoiceSelection(optionValue) {
    console.log(`[${SCRIPT_NAME}] 用户选择了选项: ${optionValue}`);
    // 隐藏选项面板
    const targetDoc = topWindow.document;
    $(targetDoc).find('#gal-layer-choices').removeClass('active');
    galgameChoicesVisible = false;
    // 隐藏按钮（因为已经选了）
    // hidePendingChoicesButton(); // ★ 用户要求保留按钮显示
    // 将选项填入输入框并自动发送
    const $textarea = $(topWindow.document).find('#send_textarea');
    const $sendButton = $(topWindow.document).find('#send_but');
    if ($textarea.length) {
      // 构建玩家选择的格式（与骰子系统的 smartInsertToTextarea 兼容）
      const playerChoice = `<user>${optionValue}。`;
      // 获取当前输入框内容
      const currentVal = ($textarea.val() || '').trim();
      // 如果输入框为空，直接填入
      if (!currentVal) {
        $textarea.val(playerChoice).trigger('input').trigger('change');
      } else {
        // 追加到现有内容
        $textarea
          .val(currentVal + ' ' + playerChoice)
          .trigger('input')
          .trigger('change');
      }
      showToast(`已选择: ${optionValue.substring(0, 20)}${optionValue.length > 20 ? '...' : ''}`);
      // ★ 自动触发发送 ★
      if ($sendButton.length) {
        setTimeout(() => {
          $sendButton.click();
          console.log(`[${SCRIPT_NAME}] 已自动触发发送`);
        }, 100);
      }
    }
  }
  /**
   * 监控骰子系统的选项面板 (改：监控数据库表格)
   */
  function setupOptionsPanelObserver() {
    // 移除旧的 MutationObserver，改为定时轮询
    setInterval(() => {
      if (!isEnabled) return; // 只在Galgame模式开启时处理
      checkAndRenderOptions();
    }, 1000); // 每秒检查一次
    // 初始检查一次
    setTimeout(checkAndRenderOptions, 500);
    console.log(`[${SCRIPT_NAME}] 选项表监控已启动 (轮询模式)`);
  }
  /**
   * 检查骰子系统选项表格并渲染到Galgame UI
   */
  function checkAndRenderOptions() {
    if (!isEnabled) return;
    // 从数据库获取选项
    const options = getOptionsFromDatabase();
    if (Math.random() < 0.05) {
      // 偶尔打印一下，避免刷屏，确认心跳
      console.log(`[${SCRIPT_NAME}] [DEBUG] checkAndRenderOptions 心跳 - 选项数: ${options.length}`);
    }
    if (options.length === 0) {
      // 如果没有选项了，且当前显示着，则隐藏
      if (galgameChoicesVisible) {
        // 只有当数据库里的选项真没了（比如被清空了），才自动隐藏面板
        // 但要注意，如果用户自己关了面板，这里不应该反复调用 hide
        hideGalgameChoices(false);
      }
      // 如果按钮显示着，也要隐藏
      if (pendingOptions) {
        hidePendingChoicesButton();
      }
      lastGalgameOptionHash = null;
      return;
    }
    // 生成选项内容的Hash指纹
    const currentOptionHash = options.map(o => o.value).join('|||');

    // ★ 始终更新全局变量并显示按钮 (只要有选项存在)
    pendingOptions = options;
    ensureGlobalOverlay();
    const $btn = $('#gal-global-overlay .gal-pending-choices-btn');
    if ($btn.length === 0) {
      console.warn(`[${SCRIPT_NAME}] [DEBUG] 警告: 找不到选项按钮元素!`);
    } else {
      // 强制移除 display: none (如果内联样式导致)
      $btn.css('display', 'flex');
      $btn.addClass('show');
      // console.log(`[${SCRIPT_NAME}] [DEBUG] 尝试显示选项按钮, 选项数: ${options.length}`);
    }

    // 判断选项是否发生实质变化
    const optionChanged = currentOptionHash !== lastGalgameOptionHash;
    if (optionChanged) {
      // 选项内容发生了实质变化
      console.log(`[${SCRIPT_NAME}] 检测到新选项，更新缓存并显示提示按钮`);

      // 添加强调动画类，3秒后移除
      $('#gal-global-overlay .gal-pending-choices-btn').addClass('gal-new-option-highlight');
      setTimeout(() => {
        $('#gal-global-overlay .gal-pending-choices-btn').removeClass('gal-new-option-highlight');
      }, 3000);
      // 判断是否需要立即弹出
      let shouldPopup = false;
      if (galgameChoicesVisible) {
        // 如果面板本身就开着，当然要刷新内容
        shouldPopup = true;
      } else {
        // 如果面板没开，检查是否在 Galgame 的最后一段
        const $overlay = $('#gal-global-overlay');
        if ($overlay.length && $overlay.hasClass('active')) {
          // ★ 关键修复：使用 .attr()
          const mesId = $overlay.find('.gal-game-container').attr('data-mes-id');
          if (mesId) {
            const state = messageSegmentState.get(String(mesId));
            // 如果当前已经在最后一段，则弹出
            // 修复逻辑：使用 length - 1 判断
            if (state && state.currentIndex >= state.segments.length - 1) {
              shouldPopup = true;
            }
          }
        }
      }
      if (shouldPopup) {
        renderGalgameChoices(options);
      }
    } else {
      // 选项没变，确保按钮状态正确（防止被误删）
      if (pendingOptions && pendingOptions.length > 0) {
        ensureGlobalOverlay(); // 确保UI存在
        $('.gal-game-container .gal-pending-choices-btn').addClass('show');
      }
    }
    // 更新缓存
    lastGalgameOptionHash = currentOptionHash;
  }
  // 辅助：从数据库获取选项
  function getOptionsFromDatabase() {
    const options = [];
    try {
      const api = topWindow.AutoCardUpdaterAPI;
      if (!api || typeof api.exportTableAsJson !== 'function') {
        // 降低日志频率，只在找不到API时偶尔打印，或者干脆不打印以免刷屏
        // console.log(`[${SCRIPT_NAME}] AutoCardUpdaterAPI 未就绪`);
        return [];
      }
      const tableData = api.exportTableAsJson();
      if (!tableData) return [];
      // 调试：打印所有表名 (仅在检测到表格时打印一次，避免刷屏？不，这里是调试，先打印出来)
      // 为了调试，我们使用一个全局标记来防止无限刷屏，但每隔几秒允许打印一次
      if (!window._galDebugTimer || Date.now() - window._galDebugTimer > 5000) {
        // console.log(`[${SCRIPT_NAME}] [DEBUG] 数据库所有表名:`, Object.values(tableData).map(s => s.name));
        window._galDebugTimer = Date.now();
      }
      // 查找选项表
      const optionSheetNames = ['选项表', '行动选项'];
      let targetSheet = null;
      for (const sheetKey of Object.keys(tableData)) {
        if (!sheetKey.startsWith('sheet_')) continue;
        const sheet = tableData[sheetKey];
        // 精确匹配
        if (optionSheetNames.includes(sheet.name)) {
          targetSheet = sheet;
          //   console.log(`[${SCRIPT_NAME}] [DEBUG] 找到目标选项表: ${sheet.name}, 行数: ${sheet.content.length}`);
          break;
        }
      }
      if (!targetSheet) {
        // console.log(`[${SCRIPT_NAME}] 未找到名称为 [${optionSheetNames.join(', ')}] 的表格`);
        return [];
      }
      if (!targetSheet.content || targetSheet.content.length < 2) {
        // console.log(`[${SCRIPT_NAME}] 选项表 [${targetSheet.name}] 内容为空或只有表头`);
        return [];
      }
      const headers = targetSheet.content[0] || [];
      const content = targetSheet.content;
      // console.log(`[${SCRIPT_NAME}] [DEBUG] 选项表头:`, headers);
      // 查找列索引
      const findCol = names => {
        for (const name of names) {
          const idx = headers.indexOf(name);
          if (idx !== -1) return idx;
        }
        return -1;
      };
      const textCols = ['选项内容', '选项文本', '内容', 'Text', 'text', 'Caption', 'caption'];
      const valueCols = ['选项值', '实际值', 'Value', 'value', 'Command', 'command'];
      const textIdx = findCol(textCols);
      const valueIdx = findCol(valueCols);
      // ★★★ 策略检测 ★★★
      // 1. 检查是否存在明确的 Text/Value 列 (垂直模式强特征)
      // 2. 检查表头是否包含多个 "选项"/"Option" (水平模式强特征)
      // 3. 回退策略：如果行数多且没有水平特征 -> 垂直

      let useVertical = false;
      let useHorizontal = false;

      // 检查水平特征
      let optionHeaderCount = 0;
      headers.forEach(h => {
        const s = String(h);
        if (s.includes('选项') || s.includes('Option')) optionHeaderCount++;
      });
      // 如果是“行动选项”表，且表头不是 Text/Value，通常每一列都是选项
      if (targetSheet.name === '行动选项' && textIdx === -1 && valueIdx === -1) {
        // 只要不是 id 列，都算
        optionHeaderCount = headers.filter(h => String(h).toLowerCase() !== 'id').length;
      }

      if (textIdx !== -1) {
        useVertical = true;
      } else if (optionHeaderCount > 0) {
        useHorizontal = true;
      } else if (content.length > 2) {
        useVertical = true;
      }

      if (useVertical) {
        // console.log(`[${SCRIPT_NAME}] [DEBUG] 使用纵向解析模式`);
        // 如果没找到特定列名，尝试使用第1列作为内容，第2列作为值（如果存在）
        const fallbackTextIdx = 0;
        const fallbackValueIdx = 1;
        const effectiveTextIdx = textIdx !== -1 ? textIdx : fallbackTextIdx;
        // 如果没有值列，就用文本列
        let effectiveValueIdx = valueIdx;
        if (effectiveValueIdx === -1) {
          effectiveValueIdx = headers.length > 1 && textIdx === -1 ? fallbackValueIdx : effectiveTextIdx;
        }
        for (let i = 1; i < content.length; i++) {
          const row = content[i];
          if (!row) continue;
          const text = row[effectiveTextIdx];
          if (text && typeof text === 'string' && text.trim()) {
            let value = text;
            if (effectiveValueIdx !== -1 && row[effectiveValueIdx]) {
              value = row[effectiveValueIdx];
            }
            options.push({ text: text.trim(), value: value.toString().trim() });
          }
        }
      }
      // ★★★ 策略2：横向表格（每列一个选项，支持多行合并） ★★★
      else {
        // console.log(`[${SCRIPT_NAME}] [DEBUG] 使用横向解析模式 (多行合并)`);
        // 遍历每一行数据 (从第1行开始)
        for (let i = 1; i < content.length; i++) {
          const dataRow = content[i];
          if (!dataRow) continue;

          headers.forEach((header, idx) => {
            if (!header) return; // 跳过 null
            const headerStr = String(header);
            // 检查表头是否包含“选项”相关字样
            // 或者，如果是“行动选项”表，我们默认所有非空表头都是选项
            let isOptionCol = headerStr.includes('选项') || headerStr.includes('Option');
            if (!isOptionCol && targetSheet.name === '行动选项') {
              // 排除明显不是选项的列（如ID）
              if (headerStr.toLowerCase() !== 'id') {
                isOptionCol = true;
              }
            }
            if (isOptionCol) {
              let text = headerStr; // 默认使用表头作为文本
              let value = headerStr; // 默认使用表头作为值
              // 如果有数据行，尝试从数据行获取
              if (dataRow && dataRow[idx]) {
                const cellVal = String(dataRow[idx]).trim();
                if (cellVal) {
                  text = cellVal;
                  value = cellVal;
                  // 只有当单元格有值时才添加
                  options.push({ text, value });
                }
                // 如果单元格为空，则忽略该列的这一行（不使用表头作为默认值，因为多行模式下通常意味着该行该列没选项）
              } else {
                // 如果是第1行且为空，旧逻辑可能会用表头。但在多行模式下，建议严格一点：只有有值才算选项。
                // 除非只有1行数据？保留旧逻辑的一点点兼容性：
                // 如果只有1行数据，且单元格为空，是否要用表头？
                // 用户现在的需求是“表格生成了两行”，说明是填了值的。
                // 所以这里改为：只添加有值的单元格。
              }
            }
          });
        }
      }
      // console.log(`[${SCRIPT_NAME}] [DEBUG] 解析出 ${options.length} 个选项`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 获取选项失败:`, e);
    }
    return options;
  }
  // ============================================
  // BGM UI 组件渲染
  // ============================================
  function renderBGMWidget() {
    // 检查是否已存在
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
    // 事件绑定
    $widget.on('click', function (e) {
      // 点击非控件区域切换展开
      if (!$(e.target).closest('.gal-bgm-btn, .gal-bgm-slider').length) {
        const isActive = $(this).toggleClass('active').hasClass('active');
        $(this).find('.gal-bgm-info, .gal-bgm-ctrl').toggle(isActive);
        // 稍微自动收起
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
      // 优先使用 audio 的实际状态判断，解决状态不同步导致无法暂停/播放的问题
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
    // 更新UI函数绑定
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
        // 添加 title 属性显示更多信息
        const singer = this.currentTrack.Singer || this.currentTrack.singer || '';
        if (singer) {
          $w.find('.gal-bgm-title').attr('title', `${trackName} - ${singer}`);
        }
      } else if (this.currentKeyword) {
        $w.find('.gal-bgm-title').text('Searching: ' + this.currentKeyword);
      }
    };
    // 初始更新
    BGMManager.updateUI();
  }
  // ============================================
  // 全局函数暴露
  // ============================================
  const exposeScope = [window];
  if (topWindow && topWindow !== window) {
    exposeScope.push(topWindow);
  }
  exposeScope.forEach(scope => {
    try {
      scope.galUI = {
        enable: () => {
          isEnabled = true;
          showToast('Galgame界面已启用');
        },
        disable: () => {
          isEnabled = false;
          showToast('Galgame界面已禁用');
        },
        isEnabled: () => isEnabled,
        parseContent: parseGalgameContent,
        saveSprite,
        getSprite,
        deleteSprite,
        showConfig: () => showSpriteConfigModal(),
        refresh: refreshGalgameViews,
        toast: showToast,
        // 选项面板控制
        showChoices: renderGalgameChoices,
        hideChoices: hideGalgameChoices,
        checkOptions: checkAndRenderOptions,
        renderMainInterface: renderMainInterface,
      };
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 无法暴露全局函数:`, e);
    }
  });
  // 立绘配置面板
  function showSpriteConfigModal() {
    return __awaiter(this, void 0, void 0, function* () {
      // 获取所有立绘
      if (!db) yield initDB();
      // 从数据库获取角色列表
      const dbCharacters = getCharacterListFromDatabase();
      const transaction = db.transaction([STORE_SPRITES], 'readonly');
      const store = transaction.objectStore(STORE_SPRITES);
      const request = store.getAll();
      request.onsuccess = () =>
        __awaiter(this, void 0, void 0, function* () {
          const sprites = request.result || [];
          // 构建角色列表HTML
          let charactersHtml = '';
          if (dbCharacters.length > 0) {
            charactersHtml = `
          <div style="margin-bottom: 20px;">
            <h4 style="color: ${THEME.accent}; margin-bottom: 15px; font-family: ${THEME.fontEng};">
              <i class="fa-solid fa-users"></i> 从数据库加载的角色 (${dbCharacters.length})
            </h4>
            <div class="gal-sprite-grid">
              ${dbCharacters
                .map(char => {
                  // 查找该角色是否有立绘（优先检查默认表情）
                  const spriteKey = `${char.name}_默认`;
                  const hasSprite = characterSprites.has(spriteKey);
                  const blobUrl = characterSprites.get(spriteKey) || '';
                  return `
                  <div class="gal-sprite-card ${hasSprite ? '' : 'no-sprite'}"
                       data-character="${char.name}"
                       data-type="${char.type}"
                       style="border-color: ${hasSprite ? THEME.accent : '#ccc'};">
                    ${
                      hasSprite
                        ? `<img class="gal-sprite-preview" src="${blobUrl}" alt="${char.name}">`
                        : `<div class="gal-sprite-preview" style="display: flex; align-items: center; justify-content: center; color: #aaa;">
                           <i class="fa-solid fa-user-plus" style="font-size: 2rem;"></i>
                         </div>`
                    }
                    <div class="gal-sprite-label">
                      ${char.name}<br>
                      <small style="color: ${char.type === '主角' ? THEME.accentSub : THEME.accent};">${char.type}</small>
                    </div>
                  </div>
                `;
                })
                .join('')}
            </div>
          </div>
          <div style="border-top: 2px solid #eee; margin: 20px 0;"></div>
        `;
          } else {
            charactersHtml = `
          <div style="padding: 30px; text-align: center; color: #888; background: #f5f5f5; margin-bottom: 20px; border-radius: 8px;">
            <i class="fa-solid fa-database" style="font-size: 2rem; margin-bottom: 10px; display: block;"></i>
            <p style="margin: 0;">未检测到数据库角色数据</p>
            <small>请确保 神·数据库 脚本已加载并包含角色信息</small>
          </div>
        `;
          }
          // 获取所有背景
          const backgrounds = yield getAllBackgrounds();
          const backgroundsHtml =
            backgrounds.length > 0
              ? backgrounds
                  .map(bg => {
                    const blobUrl = sceneBackgrounds.get(bg.id) || '';
                    return `
          <div class="gal-bg-card" data-scene="${bg.sceneName}">
            <img class="gal-bg-preview" src="${blobUrl}" alt="${bg.sceneName}">
            <div class="gal-bg-label">${bg.sceneName}</div>
            <button class="gal-bg-delete" data-scene="${bg.sceneName}" title="删除">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
                  })
                  .join('')
              : `
        <div style="grid-column: 1/-1; padding: 40px; text-align: center; color: #888;">
          <i class="fa-solid fa-image" style="font-size: 2.5rem; margin-bottom: 10px; display: block;"></i>
          <p>暂无背景图片</p>
          <small>点击上方按钮添加背景</small>
        </div>
      `;
          const modalHtml = `
        <div class="gal-config-modal" id="gal-config-modal">
          <div class="gal-config-panel" style="max-width: 850px;">
            <div class="gal-config-header">
              <div class="gal-config-title"><i class="fa-solid fa-images"></i> 资源管理</div>
              <button class="gal-config-close" id="gal-config-close">
                <i class="fa-solid fa-times"></i>
              </button>
            </div>

            <!-- Tab 切换 -->
            <div class="gal-tab-header">
              <button class="gal-tab-btn active" data-tab="sprites">
                <i class="fa-solid fa-user"></i> 立绘管理
              </button>
              <button class="gal-tab-btn" data-tab="backgrounds">
                <i class="fa-solid fa-panorama"></i> 背景管理
              </button>
            </div>

            <div class="gal-config-body">
              <!-- 立绘管理 Tab -->
              <div class="gal-tab-content active" data-tab="sprites">
                ${charactersHtml}

                <div style="display: flex; gap: 10px; margin-top: 15px;">
                  <button class="gal-action-btn" id="gal-add-sprite" style="flex: 1; padding: 12px;">
                    <i class="fa-solid fa-plus"></i>
                    <span>添加单个立绘</span>
                  </button>
                  <button class="gal-action-btn primary" id="gal-batch-add-sprite" style="flex: 1; padding: 12px;">
                    <i class="fa-solid fa-images"></i>
                    <span>批量添加（全表情）</span>
                  </button>
                </div>
              </div>

              <!-- 背景管理 Tab -->
              <div class="gal-tab-content" data-tab="backgrounds">
                <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                  <button class="gal-action-btn primary" id="gal-add-background" style="flex: 1; padding: 12px;">
                    <i class="fa-solid fa-plus"></i>
                    <span>添加背景图片</span>
                  </button>
                </div>
                <div class="gal-bg-grid">
                  ${backgroundsHtml}
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>
          .gal-tab-header {
            display: flex;
            background: #f5f5f5;
            border-bottom: 2px solid #eee;
          }
          .gal-tab-btn {
            flex: 1;
            padding: 14px 20px;
            border: none;
            background: transparent;
            font-weight: 700;
            font-size: 0.95rem;
            color: #888;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
          }
          .gal-tab-btn:hover {
            color: ${THEME.dark};
            background: rgba(0, 210, 255, 0.1);
          }
          .gal-tab-btn.active {
            color: ${THEME.dark};
            background: #fff;
            border-bottom: 3px solid ${THEME.accent};
          }
          .gal-tab-content {
            display: none;
          }
          .gal-tab-content.active {
            display: block;
          }
          .gal-bg-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
          }
          .gal-bg-card {
            position: relative;
            border: 2px solid #eee;
            border-radius: 8px;
            overflow: hidden;
            cursor: pointer;
            transition: all 0.2s;
          }
          .gal-bg-card:hover {
            border-color: ${THEME.accent};
            box-shadow: 0 4px 12px rgba(0, 210, 255, 0.15);
          }
          .gal-bg-preview {
            width: 100%;
            aspect-ratio: 16 / 9;
            object-fit: cover;
            display: block;
          }
          .gal-bg-label {
            padding: 10px;
            font-weight: 600;
            font-size: 0.85rem;
            color: ${THEME.dark};
            text-align: center;
            background: #fafafa;
          }
          .gal-bg-delete {
            position: absolute;
            top: 8px;
            right: 8px;
            width: 28px;
            height: 28px;
            border: none;
            border-radius: 50%;
            background: rgba(255, 0, 85, 0.9);
            color: #fff;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .gal-bg-card:hover .gal-bg-delete {
            opacity: 1;
          }
          .gal-bg-delete:hover {
            background: ${THEME.accentSub};
            transform: scale(1.1);
          }
        </style>
      `;
          $(topWindow.document.body).append(modalHtml);
          const $modal = $('#gal-config-modal');
          makeDraggable($modal.find('.gal-config-panel'), $modal.find('.gal-config-header'));
          $('#gal-config-close').on('click', () => $modal.remove());
          $modal.on('click', function (e) {
            if (e.target === this) $modal.remove();
          });
          // 点击数据库角色卡片上传立绘
          $modal.find('.gal-sprite-card[data-character]').on('click', function () {
            const charName = $(this).data('character');
            $modal.remove();
            showBatchUploadDialog(charName, () => showSpriteConfigModal());
          });
          // 手动添加立绘
          // 手动添加立绘（单个）
          $('#gal-add-sprite').on('click', () => {
            $modal.remove();
            showSpriteUploadDialog('default', '默认', () => showSpriteConfigModal());
          });
          // 批量添加立绘按钮
          $('#gal-batch-add-sprite').on('click', () => {
            $modal.remove();
            showBatchUploadDialog('', () => showSpriteConfigModal());
          });
          // Tab 切换事件
          $modal.find('.gal-tab-btn').on('click', function () {
            const tab = $(this).data('tab');
            $modal.find('.gal-tab-btn').removeClass('active');
            $(this).addClass('active');
            $modal.find('.gal-tab-content').removeClass('active');
            $modal.find(`.gal-tab-content[data-tab="${tab}"]`).addClass('active');
          });
          // 添加背景按钮
          $('#gal-add-background').on('click', () => {
            $modal.remove();
            showBackgroundUploadDialog(() => showSpriteConfigModal());
          });
          // 删除背景按钮
          $modal.find('.gal-bg-delete').on('click', function (e) {
            return __awaiter(this, void 0, void 0, function* () {
              e.stopPropagation();
              const sceneName = $(this).data('scene');
              if (confirm(`确定删除背景「${sceneName}」吗？`)) {
                yield deleteBackground(sceneName);
                showToast(`已删除背景: ${sceneName}`);
                $modal.remove();
                showSpriteConfigModal();
              }
            });
          });
        });
    });
  }
  /**
   * 批量背景上传对话框
   */
  function showBatchBackgroundUploadDialog(onCloseCallback) {
    const modalHtml = `
      <div class="gal-input-modal" id="gal-batch-bg-upload-modal">
        <div class="gal-input-box" style="max-width: 1100px; width: 95%; max-height: 90vh; overflow: hidden; padding: 0; display: flex; flex-direction: column;">
          <div class="gal-input-title" style="padding: 15px 25px; border-bottom: 1px solid #eee; flex-shrink: 0; margin: 0;">
            <span><i class="fa-solid fa-images"></i> 批量上传背景</span>
          </div>

          <div style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
              <!-- 初始上传界面 -->
              <div id="gal-batch-step-1" style="flex: 1; overflow-y: auto; padding: 25px;">
                  <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
                      <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
                      <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
                  </div>

                  <div id="gal-upload-local" class="gal-upload-pane">
                      <input type="file" id="gal-batch-file-input" multiple accept="image/*" style="display: none;">
                      <div class="gal-upload-card" id="gal-batch-upload-trigger" style="min-height: 200px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #ccc; border-radius: 8px; cursor: pointer;">
                        <i class="fa-solid fa-cloud-arrow-up" style="font-size: 3rem; color: #ccc;"></i>
                        <span style="font-size: 1.2rem; margin-top: 15px; color: #999;">点击选择多张图片</span>
                        <small style="color: #bbb; margin-top: 5px;">支持按住 Ctrl 或 Shift 多选</small>
                      </div>
                  </div>

                  <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
                      <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc;">
                        <label style="display: block; font-weight: 700; margin-bottom: 8px;">输入图片链接（一行一个）</label>
                        <textarea id="gal-batch-remote-urls" placeholder="https://example.com/bg1.jpg&#10;https://example.com/bg2.png"
                                  style="width: 100%; height: 200px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; font-family: monospace; resize: vertical;"></textarea>
                        <button class="gal-action-btn" id="gal-batch-fetch-remote-btn" style="width: 100%; margin-top: 10px; justify-content: center;">
                          <i class="fa-solid fa-download"></i> 解析并获取图片
                        </button>
                      </div>
                  </div>
              </div>

              <!-- 标记界面 -->
              <div id="gal-batch-step-2" style="flex: 1; display: none; flex-direction: column; overflow: hidden;">
                  <div class="gal-batch-grid-container" style="flex: 1; overflow-y: auto; padding: 20px; background: #f5f5f5;">
                      <div id="gal-batch-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 15px;">
                          <!-- JS生成网格项 -->
                      </div>
                  </div>

                  <!-- 分页控制 -->
                  <div style="padding: 10px 20px; background: #fff; border-top: 1px solid #eee; display: flex; justify-content: center; align-items: center; gap: 15px; flex-shrink: 0;">
                      <button class="gal-action-btn" id="gal-batch-prev-page" disabled><i class="fa-solid fa-chevron-left"></i> 上一页</button>
                      <span id="gal-batch-page-info" style="font-weight: bold; color: ${THEME.dark};">1 / 1</span>
                      <button class="gal-action-btn" id="gal-batch-next-page" disabled>下一页 <i class="fa-solid fa-chevron-right"></i></button>
                  </div>
              </div>
          </div>

          <!-- 底部按钮 -->
          <div class="gal-input-actions" style="display: flex; gap: 12px; padding: 15px 25px; border-top: 1px solid #eee; background: #fff; flex-shrink: 0;">
              <button class="gal-action-btn" id="gal-batch-cancel-btn" style="flex: 1; min-height: 44px; justify-content: center;">
                <span>取消</span>
              </button>
              <button class="gal-action-btn primary" id="gal-batch-save-btn" style="flex: 2; min-height: 44px; justify-content: center; display: none;">
                <i class="fa-solid fa-save"></i>
                <span id="gal-batch-save-text">保存所有背景 (0)</span>
              </button>
          </div>
        </div>
      </div>
      <style>
          .gal-batch-item {
              background: #fff;
              border-radius: 6px;
              overflow: hidden;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
              display: flex;
              flex-direction: column;
          }
          .gal-batch-preview {
              aspect-ratio: 16 / 9;
              background: #eee;
              position: relative;
          }
          .gal-batch-preview img {
              width: 100%;
              height: 100%;
              object-fit: cover;
          }
          .gal-batch-input-area {
              padding: 10px;
          }
          .gal-batch-scene-input {
              width: 100%;
              padding: 8px;
              border: 1px solid #ddd;
              border-radius: 4px;
              box-sizing: border-box;
              font-size: 0.9rem;
          }
          .gal-batch-scene-input:focus {
              border-color: ${THEME.accent};
              outline: none;
          }
          .gal-batch-remove {
              position: absolute;
              top: 5px;
              right: 5px;
              background: rgba(255, 0, 0, 0.8);
              color: white;
              border: none;
              border-radius: 50%;
              width: 24px;
              height: 24px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
          }
          .gal-batch-status {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              background: rgba(0,0,0,0.6);
              color: white;
              font-size: 10px;
              padding: 2px 5px;
              text-align: center;
          }
      </style>
    `;
    $(topWindow.document.body).append(modalHtml);
    const $modal = $('#gal-batch-bg-upload-modal');
    makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
    // 状态变量
    let batchItems = []; // { file: File|Blob, name: string, status: 'pending'|'success'|'error', msg: '' }
    let currentPage = 1;
    const itemsPerPage = 15; // 5x3
    // UI 引用
    const $step1 = $('#gal-batch-step-1');
    const $step2 = $('#gal-batch-step-2');
    const $grid = $('#gal-batch-grid');
    const $saveBtn = $('#gal-batch-save-btn');
    const $saveText = $('#gal-batch-save-text');
    // Tab 切换
    $modal.find('.gal-upload-tab').on('click', function () {
      const target = $(this).data('target');
      $modal
        .find('.gal-upload-tab')
        .removeClass('active')
        .css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
      $(this)
        .addClass('active')
        .css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
      $modal.find('.gal-upload-pane').hide();
      $modal.find(`#gal-upload-${target}`).show();
    });
    // 触发本地文件选择
    $('#gal-batch-upload-trigger').on('click', () => $('#gal-batch-file-input').click());
    // 处理本地文件选择
    $('#gal-batch-file-input').on('change', function () {
      if (this.files.length === 0) return;
      Array.from(this.files).forEach(file => {
        // 默认使用文件名（去后缀）作为场景名
        const name = file.name.replace(/\.[^/.]+$/, '');
        batchItems.push({
          file: file,
          name: name,
          status: 'pending',
          url: URL.createObjectURL(file), // 用于预览
        });
      });
      switchToTaggingView();
    });
    // 处理远程链接
    $('#gal-batch-fetch-remote-btn').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        const text = $('#gal-batch-remote-urls').val().trim();
        if (!text) return showToast('请输入图片链接');
        const urls = text
          .split('\n')
          .map(u => u.trim())
          .filter(u => u);
        if (urls.length === 0) return showToast('没有有效的链接');
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 下载验证中...');
        let successCount = 0;
        // 并发限制处理（虽然浏览器有并发限制，但为了保险起见）
        const fetchImage = url =>
          __awaiter(this, void 0, void 0, function* () {
            try {
              const response = yield fetch(url);
              if (!response.ok) throw new Error('404/Network Error');
              const blob = yield response.blob();
              if (!blob.type.startsWith('image/')) throw new Error('Not an image');
              // 尝试从 URL 提取文件名，否则命名为 remote_bg
              let name = 'remote_bg';
              try {
                const urlObj = new URL(url);
                const pathname = urlObj.pathname;
                const filename = pathname.substring(pathname.lastIndexOf('/') + 1);
                if (filename) name = filename.replace(/\.[^/.]+$/, '');
              } catch (e) {}
              batchItems.push({
                file: blob, // Blob 也可以像 File 一样处理
                name: name,
                status: 'pending',
                url: URL.createObjectURL(blob),
              });
              successCount++;
            } catch (e) {
              console.warn('Failed to fetch:', url, e);
            }
          });
        yield Promise.all(urls.map(url => fetchImage(url)));
        $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 解析并获取图片');
        if (successCount > 0) {
          switchToTaggingView();
        } else {
          showToast('未能获取任何有效图片，请检查链接');
        }
      });
    });
    // 切换到标记界面
    function switchToTaggingView() {
      $step1.hide();
      $step2.css('display', 'flex'); // flex column
      $saveBtn.show();
      renderGrid();
      updateSaveBtn();
    }
    // 渲染网格
    function renderGrid() {
      $grid.empty();
      const start = (currentPage - 1) * itemsPerPage;
      const end = Math.min(start + itemsPerPage, batchItems.length);
      const pageItems = batchItems.slice(start, end);
      pageItems.forEach((item, index) => {
        const globalIndex = start + index;
        const $card = $(`
                <div class="gal-batch-item">
                    <div class="gal-batch-preview">
                        <img src="${item.url}">
                        <button class="gal-batch-remove" data-index="${globalIndex}"><i class="fa-solid fa-times"></i></button>
                    </div>
                    <div class="gal-batch-input-area">
                        <input type="text" class="gal-batch-scene-input" data-index="${globalIndex}" value="${item.name}" placeholder="场景名称">
                    </div>
                </div>
            `);
        $grid.append($card);
      });
      // 更新分页状态
      $('#gal-batch-page-info').text(`${currentPage} / ${Math.ceil(batchItems.length / itemsPerPage) || 1}`);
      $('#gal-batch-prev-page').prop('disabled', currentPage <= 1);
      $('#gal-batch-next-page').prop('disabled', currentPage >= Math.ceil(batchItems.length / itemsPerPage));
      // 绑定事件
      $grid.find('.gal-batch-scene-input').on('input', function () {
        const idx = $(this).data('index');
        batchItems[idx].name = $(this).val();
      });
      $grid.find('.gal-batch-remove').on('click', function () {
        const idx = $(this).data('index');
        if (confirm('移除这张图片？')) {
          batchItems.splice(idx, 1);
          if (batchItems.length === 0) {
            // 如果删完了，返回第一步
            $step2.hide();
            $saveBtn.hide();
            $step1.show();
          } else {
            // 重新计算总页数，可能需要调整当前页
            const maxPage = Math.ceil(batchItems.length / itemsPerPage);
            if (currentPage > maxPage) currentPage = maxPage;
            renderGrid();
            updateSaveBtn();
          }
        }
      });
    }
    // 翻页
    $('#gal-batch-prev-page').on('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderGrid();
      }
    });
    $('#gal-batch-next-page').on('click', () => {
      const maxPage = Math.ceil(batchItems.length / itemsPerPage);
      if (currentPage < maxPage) {
        currentPage++;
        renderGrid();
      }
    });
    function updateSaveBtn() {
      $saveText.text(`保存所有背景 (${batchItems.length})`);
    }
    // 关闭
    function closeDialog() {
      $modal.remove();
      // 释放 URL 对象
      batchItems.forEach(item => {
        if (item.url) URL.revokeObjectURL(item.url);
      });
      if (typeof onCloseCallback === 'function') onCloseCallback();
    }
    $('#gal-batch-cancel-btn').on('click', closeDialog);
    // 保存逻辑
    $saveBtn.on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        // 1. 验证
        let emptyNames = 0;
        batchItems.forEach(item => {
          if (!item.name || !item.name.trim()) emptyNames++;
        });
        if (emptyNames > 0) {
          return showToast(`有 ${emptyNames} 张图片未填写场景名称，请补充完整`);
        }
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 正在保存...');
        let failCount = 0;
        for (const item of batchItems) {
          try {
            yield saveBackground(item.name.trim(), item.file);
          } catch (e) {
            console.error('Batch save failed for:', item.name, e);
            failCount++;
          }
        }
        // 更新世界书
        if (isEnabled) {
          try {
            yield injectCOTToWorldbook();
          } catch (e) {}
        }
        if (failCount === 0) {
          showToast(`成功批量保存 ${batchItems.length} 张背景！`);
          closeDialog();
        } else {
          showToast(`保存完成，但有 ${failCount} 张失败，详情请看控制台`);
          // 也可以选择不关闭，保留失败的项，但这会比较复杂，暂简化处理
          closeDialog();
        }
      });
    });
  }
  // ============================================
  // 背景上传对��框
  // ============================================
  function showBackgroundUploadDialog(onCloseCallback) {
    const modalHtml = `
      <div class="gal-input-modal" id="gal-bg-upload-modal">
        <div class="gal-input-box" style="max-width: 600px; width: 90%; padding: 25px;">
          <div class="gal-input-title" style="margin-bottom: 20px; font-size: 1.3rem;">
            <span><i class="fa-solid fa-panorama"></i> 添加背景图片</span>
          </div>

          <div style="margin-bottom: 15px;">
            <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
              <i class="fa-solid fa-tag"></i> 场景名称
            </label>
            <input type="text" id="gal-bg-scene-name" placeholder="如：教室、公园、夜晚街道"
                   style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 6px;">
            <small style="color: #888; margin-top: 5px; display: block;">场景名称需与 AI 输出的 &lt;background scene="xxx" /&gt; 标签中的 xxx 一致</small>
          </div>

          <div class="gal-upload-tabs" style="display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px;">
            <div class="gal-upload-tab active" data-target="local" style="padding: 8px 15px; cursor: pointer; font-weight: bold; color: ${THEME.dark}; border-bottom: 2px solid ${THEME.accent};">本地上传</div>
            <div class="gal-upload-tab" data-target="remote" style="padding: 8px 15px; cursor: pointer; color: #888;">远程链接</div>
            <div class="gal-upload-tab" data-target="comfyui" style="padding: 8px 15px; cursor: pointer; color: #888;">
                <i class="fa-solid fa-wand-magic-sparkles"></i> ComfyUI 生成
            </div>
          </div>

          <div id="gal-upload-local" class="gal-upload-pane">
            <input type="file" id="gal-bg-file-input" accept="image/*" style="display: none;">
            <div class="gal-upload-card" id="gal-bg-upload-trigger" style="margin-bottom: 15px; min-height: 150px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 2px dashed #ccc; border-radius: 8px; cursor: pointer;">
              <i class="fa-solid fa-cloud-arrow-up" style="font-size: 2.5rem; color: #ccc;"></i>
              <span style="font-size: 1rem; margin-top: 10px; color: #999;">点击选择背景图片</span>
              <small style="color: #bbb; margin-top: 5px;">推荐比例 16:9</small>
            </div>
          </div>

          <div id="gal-upload-remote" class="gal-upload-pane" style="display: none;">
            <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px dashed #ccc; text-align: center; min-height: 150px; display: flex; flex-direction: column; justify-content: center;">
              <div style="margin-bottom: 15px;">
                <input type="text" id="gal-bg-remote-url" placeholder="输入图片 URL (https://...)"
                       style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box;">
              </div>
              <button class="gal-action-btn" id="gal-bg-fetch-btn" style="width: 100%; justify-content: center;">
                <i class="fa-solid fa-download"></i> 获取图片
              </button>
            </div>
          </div>

          <div id="gal-upload-comfyui" class="gal-upload-pane" style="display: none;">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 15px; border-radius: 8px; color: #fff; margin-bottom: 15px;">
                    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                        <i class="fa-solid fa-panorama" style="font-size: 1.5rem;"></i>
                        <span style="font-weight: 700; font-size: 1.1rem;">ComfyUI 场景生成</span>
                    </div>
                    <div style="font-size: 0.85rem; opacity: 0.9;">
                        使用本地ComfyUI生成背景图片
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div style="flex: 1;">
                        <label style="font-weight: 700; display: block; margin-bottom: 5px;">工作流</label>
                        <select id="gal-bg-comfy-wf-select" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;"></select>
                    </div>
                </div>

                <div style="margin-bottom: 15px;">
                    <label style="display: block; font-weight: 700; margin-bottom: 8px; color: ${THEME.dark};">
                        <i class="fa-solid fa-pen-paintbrush"></i> 场景描述
                    </label>
                    <textarea id="gal-bg-comfyui-prompt"
                              placeholder="例如: empty classroom, sunset, windows, desks and chairs, no humans..."
                              style="width: 100%; height: 80px; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; resize: vertical; box-sizing: border-box;"></textarea>
                </div>

                <button class="gal-action-btn primary" id="gal-bg-comfyui-generate-btn" style="width: 100%; min-height: 50px; justify-content: center; font-size: 1.1rem;">
                    <i class="fa-solid fa-image"></i>
                    <span>生成背景</span>
                </button>
          </div>

          <div id="gal-bg-preview-container" style="display: none; margin-bottom: 15px;">
            <img id="gal-bg-preview-img" style="width: 100%; border-radius: 8px; border: 2px solid ${THEME.accent};">
          </div>

          <div class="gal-input-actions" style="display: flex; gap: 12px;">
            <button class="gal-action-btn" id="gal-bg-cancel" style="flex: 1; min-height: 44px; justify-content: center;">
              <span>取消</span>
            </button>
            <button class="gal-action-btn primary" id="gal-bg-confirm" style="flex: 1; min-height: 44px; justify-content: center;" disabled>
              <i class="fa-solid fa-save"></i>
              <span>保存背景</span>
            </button>
          </div>
        </div>
      </div>
    `;
    $(topWindow.document.body).append(modalHtml);
    const $modal = $('#gal-bg-upload-modal');
    makeDraggable($modal.find('.gal-input-box'), $modal.find('.gal-input-title'));
    const $fileInput = $('#gal-bg-file-input');
    const $uploadArea = $('#gal-bg-upload-trigger'); // Use correct ID
    const $previewContainer = $('#gal-bg-preview-container');
    const $previewImg = $('#gal-bg-preview-img');
    const $confirmBtn = $('#gal-bg-confirm');
    const $sceneNameInput = $('#gal-bg-scene-name');
    let selectedFile = null;
    // Tab 切换
    $modal.find('.gal-upload-tab').on('click', function () {
      const target = $(this).data('target');
      $modal
        .find('.gal-upload-tab')
        .removeClass('active')
        .css({ fontWeight: 'normal', color: '#888', borderBottom: 'none' });
      $(this)
        .addClass('active')
        .css({ fontWeight: 'bold', color: THEME.dark, borderBottom: `2px solid ${THEME.accent}` });
      $modal.find('.gal-upload-pane').hide();
      $modal.find(`#gal-upload-${target}`).show();
    });
    // 远程图片获取
    $('#gal-bg-fetch-btn').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        const url = $('#gal-bg-remote-url').val().trim();
        if (!url) return showToast('请输入图片链接');
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 获取中...');
        try {
          const response = yield fetch(url);
          if (!response.ok) throw new Error('网络请求失败');
          const blob = yield response.blob();
          if (!blob.type.startsWith('image/')) throw new Error('链接不是有效的图片');
          // 模拟文件选择
          const file = new File([blob], 'remote_bg.png', { type: blob.type });
          selectedFile = file;
          // 显示预览
          const reader = new FileReader();
          reader.onload = e => {
            $previewImg.attr('src', e.target.result);
            // 隐藏所有上传面板，显示预览
            $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
            $previewContainer.show();
            updateConfirmState();
          };
          reader.readAsDataURL(file);
        } catch (e) {
          showToast('获取失败: ' + e.message);
        } finally {
          $(this).prop('disabled', false).html('<i class="fa-solid fa-download"></i> 获取图片');
        }
      });
    });

    // ===================================
    // ComfyUI 背景生成逻辑
    // ===================================

    // 初始化 Workflow 下拉
    function initComfyUIBgWorkflowSelect() {
      const $sel = $('#gal-bg-comfy-wf-select');
      const workflows = getComfyWorkflows();
      const cs = getComfyUISettings();

      $sel.empty();
      $sel.append('<option value="default_bg">内置 SDXL Turbo</option>');

      Object.keys(workflows).forEach(id => {
        $sel.append(`<option value="${id}">${workflows[id].name}</option>`);
      });

      if (cs.defaultBgWorkflow) {
        $sel.val(cs.defaultBgWorkflow);
      }
    }
    initComfyUIBgWorkflowSelect();

    $('#gal-bg-comfyui-generate-btn').on('click', async function () {
      const prompt = $('#gal-bg-comfyui-prompt').val().trim();
      const wfId = $('#gal-bg-comfy-wf-select').val();

      if (!prompt) {
        showToast('请输入场景描述');
        return;
      }

      $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 生成中...');

      const positive = [prompt, 'scenery, background, no humans, masterpiece, best quality, highres'].join(', ');

      const cs = getComfyUISettings();
      const negative = cs.negativePrompt || DEFAULT_COMFYUI_SETTINGS.negativePrompt;

      let workflow;
      if (wfId === 'default_bg' || !wfId) {
        workflow = ComfyUIAPI.buildDefaultWorkflow(positive, negative, 1280, 720, 20, 7); // 16:9 默认
      } else {
        const workflows = getComfyWorkflows();
        const stored = workflows[wfId];
        if (stored) {
          workflow = stored.json;
        } else {
          workflow = ComfyUIAPI.buildDefaultWorkflow(positive, negative, 1280, 720, 20, 7);
        }
      }

      try {
        const blob = await ComfyUIAPI.generate(workflow, positive, negative);

        // 模拟文件选择逻辑，复用 existing logic
        const file = new File([blob], 'generated_bg.png', { type: blob.type });
        selectedFile = file;

        // 显示预览
        const reader = new FileReader();
        reader.onload = e => {
          $previewImg.attr('src', e.target.result);
          $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
          $previewContainer.show();
          updateConfirmState();
          // 自动填入场景名建议（如果为空）
          if (!$sceneNameInput.val()) {
            $sceneNameInput.val(prompt.split(',')[0].substring(0, 10));
            updateConfirmState();
          }
        };
        reader.readAsDataURL(file);

        showToast('背景生成成功！');
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] ComfyUI生成失败:`, e);
        showToast('生成失败: ' + e.message);
      } finally {
        $(this).prop('disabled', false).html('<i class="fa-solid fa-image"></i><span>生成背景</span>');
      }
    });

    // 点击上传区域
    $uploadArea.on('click', () => $fileInput.click());
    // 文件选择
    $fileInput.on('change', function () {
      const file = this.files[0];
      if (!file) return;
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = e => {
        $previewImg.attr('src', e.target.result);
        // 隐藏所有上传面板，显示预览
        $modal.find('.gal-upload-tabs, .gal-upload-pane').hide();
        $previewContainer.show();
        updateConfirmState();
      };
      reader.readAsDataURL(file);
    });
    // 点击预览图可以重新选择
    $previewContainer.on('click', () => $fileInput.click());
    // 场景名称输入
    $sceneNameInput.on('input', updateConfirmState);
    function updateConfirmState() {
      const hasFile = selectedFile !== null;
      const hasName = $sceneNameInput.val().trim() !== '';
      $confirmBtn.prop('disabled', !(hasFile && hasName));
    }
    // 统一关闭处理
    const handleClose = () => {
      $modal.remove();
      if (typeof onCloseCallback === 'function') {
        try {
          onCloseCallback();
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] 回调执行失败:`, e);
        }
      }
    };
    // 取消
    $('#gal-bg-cancel').on('click', handleClose);
    $modal.on('click', function (e) {
      if (e.target === this) handleClose();
    });
    // 保存
    $('#gal-bg-confirm').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        const sceneName = $sceneNameInput.val().trim();
        if (!sceneName || !selectedFile) return;
        $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 保存中...');
        try {
          // 转换为 Blob
          const blob = yield new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = () => {
              const arrayBuffer = reader.result;
              resolve(new Blob([arrayBuffer], { type: selectedFile.type }));
            };
            reader.readAsArrayBuffer(selectedFile);
          });
          yield saveBackground(sceneName, blob);
          showToast(`背景已保存: ${sceneName}`);
          // 自动更新世界书中的场景列表
          if (isEnabled) {
            injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 更新世界书失败:`, e));
          }
          handleClose();
        } catch (e) {
          console.error(`[${SCRIPT_NAME}] 保存背景失败:`, e);
          showToast('保存失败');
          $(this).prop('disabled', false).html('<i class="fa-solid fa-save"></i><span>保存背景</span>');
        }
      });
    });
  }
  // ============================================
  // 设置面板
  // ============================================
  function showSettingsPanel() {
    const existingPanel = $('#gal-settings-panel');
    if (existingPanel.length) {
      existingPanel.remove();
      return;
    }
    const panelHtml = `
      <div class="gal-config-modal" id="gal-settings-panel">
        <div class="gal-config-panel" style="max-width: 520px; max-height: 90vh; overflow-y: auto;">
          <div class="gal-config-header">
            <div class="gal-config-title"><i class="fa-solid fa-gamepad"></i> Galgame 设置</div>
            <button class="gal-config-close" id="gal-settings-close">
              <i class="fa-solid fa-times"></i>
            </button>
          </div>
          <div class="gal-config-body" style="padding: 24px;">

            <!-- 主开关 -->
            <div style="text-align: center; margin-bottom: 24px;">
              <button id="gal-main-toggle" class="${isEnabled ? 'gal-toggle-on' : 'gal-toggle-off'}"
                      style="padding: 14px 40px; font-size: 1.1rem; font-weight: 800; border: none; border-radius: 8px; cursor: pointer; transition: all 0.3s; display: inline-flex; align-items: center; gap: 10px;">
                <i class="fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}" style="font-size: 1.3rem;"></i>
                <span>${isEnabled ? 'Galgame 模式已开启' : 'Galgame 模式已关闭'}</span>
              </button>
              <p style="margin-top: 8px; font-size: 0.8rem; color: #999;">当前角色卡独立设置</p>
            </div>

            <div class="gal-settings-divider"></div>

            <!-- 📝 文本显示 -->
            <div class="gal-settings-section">
              <div class="gal-settings-section-title">
                <i class="fa-solid fa-font"></i> 文本显示
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">字体大小</span>
                <div class="gal-settings-control">
                  <input type="range" id="gal-font-size" min="14" max="24" step="1" value="${settings.fontSize}">
                  <span class="gal-range-value" id="gal-font-size-value">${settings.fontSize}px</span>
                </div>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">对话框透明度</span>
                <div class="gal-settings-control">
                  <input type="range" id="gal-dialog-opacity" min="50" max="100" step="5" value="${Math.round(settings.dialogOpacity * 100)}">
                  <span class="gal-range-value" id="gal-dialog-opacity-value">${Math.round(settings.dialogOpacity * 100)}%</span>
                </div>
              </div>
            </div>

            <div class="gal-settings-divider"></div>

            <!-- ▶️ 自动播放 -->
            <div class="gal-settings-section">
              <div class="gal-settings-section-title">
                <i class="fa-solid fa-play"></i> 自动播放
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">播放间隔</span>
                <div class="gal-settings-control">
                  <input type="range" id="gal-auto-speed" min="1" max="8" step="0.5" value="${settings.autoPlaySpeed}">
                  <span class="gal-range-value" id="gal-auto-speed-value">${settings.autoPlaySpeed}秒</span>
                </div>
              </div>
            </div>

            <div class="gal-settings-divider"></div>

            <!-- 🖼️ 显示设置 -->
            <div class="gal-settings-section">
              <div class="gal-settings-section-title">
                <i class="fa-solid fa-display"></i> 显示设置
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">显示立绘</span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-show-sprites" ${settings.showSprites ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">沉浸模式 <small style="color:#999;">(隐藏其他楼层)</small></span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-hide-floors" ${settings.hideOtherFloors ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>
            </div>

            <div class="gal-settings-divider"></div>

            <!-- 🖼️ 立绘设置 -->
            <div class="gal-settings-section">
              <div class="gal-settings-section-title">
                <i class="fa-solid fa-user"></i> 立绘设置
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">立绘大小</span>
                <div class="gal-settings-control">
                  <input type="range" id="gal-sprite-scale" min="50" max="150" step="5" value="${settings.spriteScale}">
                  <span class="gal-range-value" id="gal-sprite-scale-value">${settings.spriteScale}%</span>
                </div>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">垂直位置 <small style="color:#999;">(底部偏移)</small></span>
                <div class="gal-settings-control">
                  <input type="range" id="gal-sprite-bottom" min="0" max="50" step="1" value="${settings.spriteBottomOffset}">
                  <span class="gal-range-value" id="gal-sprite-bottom-value">${settings.spriteBottomOffset}%</span>
                </div>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">立绘间距 <small style="color:#999;">(左右距离)</small></span>
                <div class="gal-settings-control">
                  <input type="range" id="gal-sprite-spacing" min="0" max="20" step="1" value="${settings.spriteSpacing}">
                  <span class="gal-range-value" id="gal-sprite-spacing-value">${settings.spriteSpacing}%</span>
                </div>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">说话者光晕 <small style="color:#999;">(轮廓发光)</small></span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-speaker-glow" ${settings.speakerGlow ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">气泡指示器 <small style="color:#999;">(漫画风格)</small></span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-speaker-bubble" ${settings.speakerBubble ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>
            </div>

            <div class="gal-settings-divider"></div>

            <!-- ⌨️ 快捷键 -->
            <div class="gal-settings-section">
              <div class="gal-settings-section-title">
                <i class="fa-solid fa-keyboard"></i> 快捷键
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">空格键 → 下一句</span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-space-next" ${settings.spaceKeyNext ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">回车键 → 下一句</span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-enter-next" ${settings.enterKeyNext ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">Ctrl长按 → 快进</span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-ctrl-skip" ${settings.ctrlKeySkip ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>
            </div>

            <div class="gal-settings-divider"></div>

            <!-- ⏩ 快进设置 -->
            <div class="gal-settings-section">
              <div class="gal-settings-section-title">
                <i class="fa-solid fa-forward"></i> 快进设置
              </div>

              <!-- 智能检测设置 (插入在快进设置之前) -->
              <div class="gal-settings-row">
                <span class="gal-settings-label" title="开启后，只有检测到Galgame标签才会显示界面；关闭则总是显示">
                   智能判断主界面显示
                </span>
                <label class="gal-switch">
                  <input type="checkbox" id="gal-smart-detection" ${settings.smartDetection ? 'checked' : ''}>
                  <span class="gal-switch-slider"></span>
                </label>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">快进速度</span>
                <div class="gal-settings-control">
                  <input type="range" id="gal-skip-speed" min="0.01" max="0.2" step="0.01" value="${settings.skipSpeed}">
                  <span class="gal-range-value" id="gal-skip-speed-value">${settings.skipSpeed}s</span>
                </div>
              </div>
            </div>

            <div class="gal-settings-divider"></div>

            <!-- 🎨 ComfyUI 文生图设置 -->
            <div class="gal-settings-section">
              <div class="gal-settings-section-title">
                <i class="fa-solid fa-wand-magic-sparkles"></i> ComfyUI 文生图
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">API 地址 (您必须在启动 ComfyUI 时加上以下参数： --enable-cors-header)</span>
                <div class="gal-settings-control">
                  <input type="text" id="gal-comfyui-url"
                         value="${getComfyUISettings().apiUrl}"
                         placeholder="http://127.0.0.1:8188"
                         style="width: 180px; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem;">
                </div>
              </div>

              <div class="gal-settings-row">
                <button class="gal-action-btn" id="gal-comfyui-test" style="width: 100%; justify-content: center; padding: 10px;">
                  <i class="fa-solid fa-plug"></i> 测试连接
                </button>
              </div>

              <!-- 工作流管理 -->
              <div class="gal-settings-row" style="flex-direction: column; align-items: stretch; gap: 10px;">
                 <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span class="gal-settings-label" style="font-weight: 700;">工作流管理 (.json)</span>
                    <input type="file" id="gal-comfy-import-input" accept=".json" style="display: none;">
                    <button class="gal-action-btn" id="gal-comfy-import-btn" style="padding: 4px 10px; font-size: 0.8rem;">
                        <i class="fa-solid fa-file-import"></i> 导入 JSON
                    </button>
                 </div>
                 <div id="gal-workflow-list" style="max-height: 120px; overflow-y: auto; background: #f8f9fa; border: 1px solid #eee; border-radius: 4px; padding: 8px;">
                    <div style="text-align: center; color: #999; font-size: 0.85rem; padding: 10px;">暂无导入的工作流</div>
                 </div>
              </div>

               <div class="gal-settings-row">
                <span class="gal-settings-label">默认角色 Workflow</span>
                <select id="gal-comfy-def-char" style="width: 160px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="default_char">内置 SDXL Turbo</option>
                </select>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">默认 Checkpoint 模型</span>
                <select id="gal-comfy-def-checkpoint" style="width: 160px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">(加载中...)</option>
                </select>
              </div>

              <div class="gal-settings-row">
                <span class="gal-settings-label">默认背景 Workflow</span>
                <select id="gal-comfy-def-bg" style="width: 160px; padding: 4px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="default_bg">内置 SDXL Turbo</option>
                </select>
              </div>



              <div class="gal-settings-row" style="flex-direction: column; align-items: stretch;">
                <span class="gal-settings-label" style="margin-bottom: 8px;">负面提示词</span>
                <textarea id="gal-comfyui-negative"
                          placeholder="lowres, bad anatomy..."
                          style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 0.85rem; resize: vertical;">${getComfyUISettings().negativePrompt}</textarea>
              </div>


            <div class="gal-settings-divider"></div>

            <!-- 功能按钮组 -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 16px;">
              <button class="gal-panel-btn" id="gal-open-sprite-manager">
                <i class="fa-solid fa-images"></i>
                <span>立绘管理</span>
              </button>
              <button class="gal-panel-btn secondary" id="gal-refresh-views">
                <i class="fa-solid fa-sync"></i>
                <span>刷新视图</span>
              </button>
            </div>

          </div>
        </div>
      </div>

      <style>
        .gal-toggle-on {
          background: linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%);
          color: #fff;
          box-shadow: 0 4px 15px rgba(0, 210, 255, 0.4);
        }
        .gal-toggle-off {
          background: #e0e0e0;
          color: #666;
        }
        .gal-toggle-on:hover, .gal-toggle-off:hover {
          transform: scale(1.02);
        }

        .gal-settings-divider {
          border-top: 1px solid #e0e0e0;
          margin: 16px 0;
        }

        .gal-settings-section {
          margin-bottom: 8px;
        }

        .gal-settings-section-title {
          font-weight: 700;
          font-size: 0.95rem;
          color: ${THEME.dark};
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .gal-settings-section-title i {
          color: ${THEME.accent};
        }

        .gal-settings-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .gal-settings-row:last-child {
          border-bottom: none;
        }

        .gal-settings-label {
          font-size: 0.9rem;
          color: #444;
        }

        .gal-settings-control {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .gal-settings-control input[type="range"] {
          width: 120px;
          accent-color: ${THEME.accent};
        }

        .gal-range-value {
          min-width: 45px;
          text-align: right;
          font-weight: 600;
          font-size: 0.85rem;
          color: ${THEME.accent};
        }

        /* Toggle Switch */
        .gal-switch {
          position: relative;
          display: inline-block;
          width: 48px;
          height: 26px;
        }

        .gal-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .gal-switch-slider {
          position: absolute;
          cursor: pointer;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 26px;
        }

        .gal-switch-slider:before {
          position: absolute;
          content: "";
          height: 20px;
          width: 20px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .gal-switch input:checked + .gal-switch-slider {
          background: linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%);
        }

        .gal-switch input:checked + .gal-switch-slider:before {
          transform: translateX(22px);
        }

        .gal-panel-btn {
          padding: 14px;
          background: linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%);
          color: #fff;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 700;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .gal-panel-btn.secondary {
          background: linear-gradient(135deg, #666 0%, #444 100%);
        }

        .gal-panel-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        .gal-panel-btn i {
          font-size: 1.3rem;
        }
      </style>
    `;
    $(topWindow.document.body).append(panelHtml);
    const $panel = $('#gal-settings-panel');
    makeDraggable($panel.find('.gal-config-panel'), $panel.find('.gal-config-header'));
    // 关闭
    $('#gal-settings-close').on('click', () => $panel.remove());
    $panel.on('click', function (e) {
      if (e.target === this) $panel.remove();
    });
    // 主开关
    $('#gal-main-toggle').on('click', function () {
      return __awaiter(this, void 0, void 0, function* () {
        isEnabled = !isEnabled;
        setCurrentCharEnabled(isEnabled); // 保存到角色卡独立存储
        updateButtonState();
        if (isEnabled) {
          $(this).removeClass('gal-toggle-off').addClass('gal-toggle-on');
          $(this).html(
            '<i class="fa-solid fa-toggle-on" style="font-size: 1.3rem;"></i><span>Galgame 模式已开启</span>',
          );
          yield injectCOTToWorldbook();
          yield enableWorldbookGlobally();
          applyGalgameMode();
          if (settings.hideOtherFloors) hideNonLastFloors();
          showToast('Galgame 模式已开启');
        } else {
          $(this).removeClass('gal-toggle-on').addClass('gal-toggle-off');
          $(this).html(
            '<i class="fa-solid fa-toggle-off" style="font-size: 1.3rem;"></i><span>Galgame 模式已关闭</span>',
          );
          yield disableWorldbookGlobally();
          restoreOriginalViews();
          // 延迟滚动到最后一条消息
          setTimeout(() => {
            const $lastMes = $('#chat > .mes').last();
            if ($lastMes.length) {
              $lastMes[0].scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
          }, 150);
          showToast('Galgame 模式已关闭');
        }
      });
    });
    // 滑块设置
    $('#gal-font-size').on('input', function () {
      settings.fontSize = parseInt($(this).val());
      $('#gal-font-size-value').text(settings.fontSize + 'px');
      applySettingsToUI();
      saveSettings();
    });
    $('#gal-dialog-opacity').on('input', function () {
      settings.dialogOpacity = parseInt($(this).val()) / 100;
      $('#gal-dialog-opacity-value').text(Math.round(settings.dialogOpacity * 100) + '%');
      applySettingsToUI();
      saveSettings();
    });
    $('#gal-auto-speed').on('input', function () {
      settings.autoPlaySpeed = parseFloat($(this).val());
      $('#gal-auto-speed-value').text(settings.autoPlaySpeed + '秒');
      saveSettings();
    });
    // 开关设置
    $('#gal-show-sprites').on('change', function () {
      settings.showSprites = $(this).is(':checked');
      applySettingsToUI();
      saveSettings();
    });
    $('#gal-hide-floors').on('change', function () {
      settings.hideOtherFloors = $(this).is(':checked');
      hideOtherFloors = settings.hideOtherFloors;
      if (settings.enabled) {
        if (settings.hideOtherFloors) {
          hideNonLastFloors();
        } else {
          showAllFloors();
        }
      }
      saveSettings();
    });
    $('#gal-space-next').on('change', function () {
      settings.spaceKeyNext = $(this).is(':checked');
      saveSettings();
    });
    $('#gal-enter-next').on('change', function () {
      settings.enterKeyNext = $(this).is(':checked');
      saveSettings();
    });
    $('#gal-ctrl-skip').on('change', function () {
      settings.ctrlKeySkip = $(this).is(':checked');
      saveSettings();
    });
    $('#gal-skip-speed').on('input', function () {
      settings.skipSpeed = parseFloat($(this).val());
      $('#gal-skip-speed-value').text(settings.skipSpeed + 's');
      saveSettings();
    });
    // 智能检测开关
    $('#gal-smart-detection').on('change', function () {
      settings.smartDetection = $(this).is(':checked');
      saveSettings();
      // 如果改变了设置，可能需要刷新视图状态
      if (isEnabled) {
        applyGalgameMode();
      }
    });
    // 立绘设置滑块
    $('#gal-sprite-scale').on('input', function () {
      settings.spriteScale = parseInt($(this).val());
      $('#gal-sprite-scale-value').text(settings.spriteScale + '%');
      applySettingsToUI();
      saveSettings();
    });
    $('#gal-sprite-bottom').on('input', function () {
      settings.spriteBottomOffset = parseInt($(this).val());
      $('#gal-sprite-bottom-value').text(settings.spriteBottomOffset + '%');
      applySettingsToUI();
      saveSettings();
    });
    $('#gal-sprite-spacing').on('input', function () {
      settings.spriteSpacing = parseInt($(this).val());
      $('#gal-sprite-spacing-value').text(settings.spriteSpacing + '%');
      applySettingsToUI();
      saveSettings();
    });
    // 说话者效果开关
    $('#gal-speaker-glow').on('change', function () {
      settings.speakerGlow = $(this).is(':checked');
      applySettingsToUI();
      saveSettings();
    });
    $('#gal-speaker-bubble').on('change', function () {
      settings.speakerBubble = $(this).is(':checked');
      applySettingsToUI();
      saveSettings();
    });
    // 立绘管理
    $('#gal-open-sprite-manager').on('click', () => {
      $panel.remove();
      showAssetManagerModal();
    });
    // 刷新视图
    $('#gal-refresh-views').on('click', () => {
      if (settings.enabled) {
        applyGalgameMode();
        if (settings.hideOtherFloors) hideNonLastFloors();
        showToast('视图已刷新');
      } else {
        showToast('请先开启 Galgame 模式');
      }
    });

    // ComfyUI 设置绑定
    $('#gal-comfyui-url').on('change', function () {
      const cs = getComfyUISettings();
      cs.apiUrl = $(this).val().trim();
      saveComfyUISettings(cs);
    });

    $('#gal-comfyui-negative').on('change', function () {
      const cs = getComfyUISettings();
      cs.negativePrompt = $(this).val();
      saveComfyUISettings(cs);
    });

    $('#gal-comfyui-test').on('click', async function () {
      $(this).prop('disabled', true).html('<i class="fa-solid fa-spinner fa-spin"></i> 测试中...');
      const ok = await ComfyUIAPI.checkConnection();
      $(this).prop('disabled', false).html('<i class="fa-solid fa-plug"></i> 测试连接');
      showToast(ok ? 'ComfyUI 连接成功！' : 'ComfyUI 连接失败，请检查地址和CORS设置');
    });

    // 工作流管理逻辑
    function renderWorkflowList() {
      const workflows = getComfyWorkflows();
      const $list = $('#gal-workflow-list');
      const $selChar = $('#gal-comfy-def-char');
      const $selBg = $('#gal-comfy-def-bg');
      const cs = getComfyUISettings();

      $list.empty();
      $selChar.html('<option value="default_char">内置 SDXL Turbo</option>');
      $selBg.html('<option value="default_bg">内置 SDXL Turbo</option>');

      const keys = Object.keys(workflows);
      if (keys.length === 0) {
        $list.html(
          '<div style="text-align: center; color: #999; font-size: 0.85rem; padding: 10px;">暂无导入的工作流</div>',
        );
      } else {
        keys.forEach(id => {
          const wf = workflows[id];
          const $item = $(`
                        <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; border-bottom: 1px solid #eee; font-size: 0.9rem;">
                            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 250px;" title="${wf.name}">${wf.name}</span>
                            <i class="fa-solid fa-trash" style="color: #ff4d4d; cursor: pointer; padding: 4px;" title="删除"></i>
                        </div>
                    `);
          $item.find('.fa-trash').on('click', () => {
            if (confirm(`确定要删除工作流 "${wf.name}" 吗？`)) {
              delete workflows[id];
              saveComfyWorkflows(workflows);
              renderWorkflowList();
            }
          });
          $list.append($item);

          // 下拉选项
          $selChar.append(`<option value="${id}">${wf.name}</option>`);
          $selBg.append(`<option value="${id}">${wf.name}</option>`);
        });
      }

      // 恢复选中状态
      $selChar.val(cs.defaultCharWorkflow || 'default_char');
      $selChar.val(cs.defaultCharWorkflow || 'default_char');
      $selBg.val(cs.defaultBgWorkflow || 'default_bg');
    }

    renderWorkflowList();

    // 加载模型列表 (Populate Checkpoints)
    async function loadCheckpointsToSelect() {
      const $sel = $('#gal-comfy-def-checkpoint');
      const cs = getComfyUISettings();
      const baseUrl = cs.apiUrl;

      try {
        const models = await ComfyUIAPI.getModels(baseUrl);
        $sel.empty();
        $sel.append('<option value="">-- 使用 Workflow默认 --</option>');

        models.forEach(m => {
          $sel.append(`<option value="${m}">${m}</option>`);
        });

        if (cs.defaultCheckpoint) {
          $sel.val(cs.defaultCheckpoint);
        }
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 加载模型失败:`, e);
        $sel.html('<option value="">(加载失败)</option>');
      }
    }
    loadCheckpointsToSelect();

    // 绑定 Checkpoint 变更
    $('#gal-comfy-def-checkpoint').on('change', function () {
      const cs = getComfyUISettings();
      cs.defaultCheckpoint = $(this).val();
      saveComfyUISettings(cs);
    });

    // 导入
    $('#gal-comfy-import-btn').on('click', () => $('#gal-comfy-import-input').click());
    $('#gal-comfy-import-input').on('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const json = JSON.parse(e.target.result);
          const name = file.name.replace('.json', '');
          const id = 'wf_' + Date.now();
          const workflows = getComfyWorkflows();
          workflows[id] = { name, json };
          saveComfyWorkflows(workflows);
          renderWorkflowList();
          showToast(`已导入工作流: ${name}`);
        } catch (err) {
          showToast('无效的 JSON 文件');
          console.error(err);
        }
        $(this).val(''); // 重置
      };
      reader.readAsText(file);
    });

    // 默认工作流变更
    $('#gal-comfy-def-char').on('change', function () {
      const cs = getComfyUISettings();
      cs.defaultCharWorkflow = $(this).val();
      saveComfyUISettings(cs);
    });
    $('#gal-comfy-def-bg').on('change', function () {
      const cs = getComfyUISettings();
      cs.defaultBgWorkflow = $(this).val();
      saveComfyUISettings(cs);
    });
  }
  // 应用设置到 UI
  function applySettingsToUI() {
    var _a;
    // 字体大小
    $('.gal-dialog-text').css('font-size', settings.fontSize + 'px');
    // 对话框透明度
    $('.gal-dialog-layer').css('background', `rgba(255, 255, 255, ${settings.dialogOpacity})`);
    // 立绘显示/隐藏
    if (settings.showSprites) {
      $('.gal-layer-character').show();
    } else {
      $('.gal-layer-character').hide();
    }
    // 立绘位置和大小设置
    // ★ 使用 .attr('style') 强制覆盖，避免 jQuery .css() 可能被其他机制干扰
    // 同时保留其他样式
    const $charLayer = $('.gal-layer-character');
    $charLayer.css({
      bottom: settings.spriteBottomOffset + '%',
      gap: settings.spriteSpacing + '%',
    });
    // 单独设置 CSS 变量
    (_a = $charLayer.get(0)) === null || _a === void 0
      ? void 0
      : _a.style.setProperty('--base-scale', settings.spriteScale / 100);
    // 说话者光晕效果
    if (settings.speakerGlow) {
      $('.gal-layer-character').addClass('glow-enabled');
    } else {
      $('.gal-layer-character').removeClass('glow-enabled');
    }
    // 漫画式气泡指示器
    if (settings.speakerBubble) {
      $('.gal-layer-character').addClass('bubble-enabled');
    } else {
      $('.gal-layer-character').removeClass('bubble-enabled');
    }
  }
  // 应用 Galgame 模式
  function applyGalgameMode() {
    // 找到最后一条AI消息并检查是否有Galgame内容
    let hasValidGalgameContent = false;
    const $allMes = $('#chat > .mes');
    let $lastAiMes = null;
    $allMes.each(function () {
      if ($(this).attr('is_user') !== 'true') {
        $lastAiMes = $(this);
      }
    });
    if ($lastAiMes && $lastAiMes.length) {
      const $mesText = $lastAiMes.find('.mes_text');
      const html = $mesText.html();
      if (html) {
        const decodedHtml = decodeHtml(html);
        const hasGalTags = /<(p|sprite|maintext)[^>]*>/i.test(decodedHtml);
        if (hasGalTags) {
          const parsed = parseGalgameContent(decodedHtml);
          if (parsed.segments.length > 0) {
            hasValidGalgameContent = true;
          }
        } else if (!settings.smartDetection) {
          // 如果智能检测关闭（默认），且内容不为空，也强制显示
          // 尝试解析纯文本
          const parsed = parseGalgameContent(decodedHtml);
          if (parsed.segments.length > 0) {
            hasValidGalgameContent = true;
            console.log(`[${SCRIPT_NAME}] 智能检测已关闭，强制显示非Galgame格式内容`);
          }
        }
      }
    }
    // 如果最后的AI消息没有Galgame内容，隐藏覆盖层
    if (!hasValidGalgameContent) {
      hideGlobalOverlay();
      console.log(`[${SCRIPT_NAME}] 最后的AI消息不包含Galgame格式，隐藏覆盖层`);
      return;
    }
    // 处理最后一条AI消息（只处理最后一条，避免不必要的开销）
    if ($lastAiMes && $lastAiMes.length) {
      processNewMessage($lastAiMes[0]);
    }
    // 强制隐藏其他楼层 - Galgame 模式必须只显示最后一条
    hideNonLastFloors();
    // 应用立绘设置（位置、大小等）
    applySettingsToUI();
  }
  // 恢复原始视图
  function restoreOriginalViews() {
    // 隐藏全局覆盖层
    hideGlobalOverlay();
    // 仅移除不在全局覆盖层内的 Galgame 容器（如果有遗留的嵌入式容器）
    $('.gal-game-container')
      .not('#gal-global-overlay .gal-game-container')
      .each(function () {
        const mesId = $(this).attr('data-mes-id') || $(this).data('mes-id'); // 兼容 .attr
        if (mesId) {
          const $mes = $(`.mes[mesid="${mesId}"]`);
          const $mesText = $mes.find('.mes_text');
          // 显示原始内容
          $mesText.show();
          // 移除隐藏类
          $mes.removeClass('gal-hidden');
        }
        // 移除 Galgame 容器
        $(this).remove();
      });
    // 确保所有文本显示（防止异常）
    $('.mes_text').show();
    showAllFloors();
  }
  // 隐藏非最后楼层（使用CSS类确保!important生效）
  function hideNonLastFloors() {
    const $allMes = $('#chat > .mes');
    // 找到最后一条AI消息
    let $lastAiMes = null;
    $allMes.each(function () {
      if ($(this).attr('is_user') !== 'true') {
        $lastAiMes = $(this);
      }
    });
    // 隐藏所有消息楼层（包括最后一条AI消息，因为内容显示在覆盖层中）
    $allMes.each(function () {
      $(this).addClass('gal-hidden');
    });
    console.log(`[${SCRIPT_NAME}] 已隐藏 ${$allMes.length} 个消息楼层`);
  }
  // 显示所有楼层
  function showAllFloors() {
    const $allMes = $('#chat > .mes');
    // 强制移除隐藏类
    $allMes.each(function () {
      $(this).removeClass('gal-hidden');
      // 确保内联样式也被清除
      $(this).css('display', '');
    });
    console.log(`[${SCRIPT_NAME}] 已显示所有消息楼层，共 ${$allMes.length} 个`);
  }
  /**
   * 向消息中注入 Galgame 开启按钮
   */
  function injectGalgameButton(mesNode) {
    const $mes = $(mesNode);
    // 只给 AI 消息添加
    if ($mes.attr('is_user') === 'true') return;
    // 检查是否已存在
    if ($mes.find('.gal-open-btn').length) return;
    // 尝试插入到 mes_buttons (位于消息底部或侧边的按钮组)
    const $buttons = $mes.find('.mes_buttons');
    // 创建按钮HTML - 使用块级居中样式
    const btnHtml = `
            <div class="gal-open-btn-container" style="display: flex; justify-content: center; width: 100%; margin-top: 10px; padding: 5px 0;">
                <div class="gal-open-btn" title="进入 Galgame 模式">
                    <i class="fa-solid fa-gamepad"></i> 进入 Galgame 模式
                </div>
            </div>
        `;

    // 查找 mes_block 并追加到末尾
    const $mesBlock = $mes.find('.mes_block');
    if ($mesBlock.length) {
      $mesBlock.append(btnHtml);
    } else {
      // 回退方案
      $mes.append(btnHtml);
    }
  }
  // ============================================
  // 初始化
  // ============================================
  function addMenuButton() {
    const $existingBtn = $(`#${SCRIPT_ID}-btn`);
    if ($existingBtn.length) $existingBtn.remove();
    const $btn = $(`
      <div id="${SCRIPT_ID}-btn" class="menu_button" title="${SCRIPT_NAME} 设置"
           style="border: 2px solid; box-shadow: 3px 3px 0 rgba(0,0,0,0.2);">
        <i class="fa-solid fa-gamepad"></i>
        <span>Galgame</span>
      </div>
    `);
    $btn.on('click', e => {
      e.stopPropagation();
      showSettingsPanel();
    });
    // 添加到菜单
    if ($('#extensionsMenu').length) {
      $('#extensionsMenu').append($btn);
      console.log(`[${SCRIPT_NAME}] 按钮已添加到扩展菜单`);
    } else if ($('#top-bar').length) {
      $('#top-bar').append($btn);
      console.log(`[${SCRIPT_NAME}] 按钮已添加到顶部菜单`);
    }
    updateButtonState();
  }
  function updateButtonState() {
    const $btn = $(`#${SCRIPT_ID}-btn`);
    if (isEnabled) {
      $btn.css('background', THEME.accent);
      $btn.css('color', THEME.dark);
    } else {
      $btn.css('background', '');
      $btn.css('color', '');
    }
  }
  function init() {
    return __awaiter(this, void 0, void 0, function* () {
      console.log(`[${SCRIPT_NAME}] v${VERSION} 开始初始化...`);
      try {
        // 加载设置
        loadSettings();
        isEnabled = isCurrentCharEnabled(); // 使用角色卡独立状态
        hideOtherFloors = settings.hideOtherFloors;
        yield initDB();
        yield loadAllSpritesToCache();
        yield loadAllBackgroundsToCache();
        SpriteManager.init(); // 初始化立绘管理器（获取主角名称）
        injectStyles();
        // 延迟添加按钮和启动监听器
        setTimeout(() => {
          // ★ 延迟后重新检查角色卡状态（此时角色卡应该已加载）
          isEnabled = isCurrentCharEnabled();
          console.log(`[${SCRIPT_NAME}] 当前角色ID: ${getCurrentCharId()}, Galgame模式: ${isEnabled ? '开' : '关'}`);
          addMenuButton();
          setupMessageObserver();
          setupGlobalEventListeners(); // 替换为全局事件监听
          setupKeyboardShortcuts();
          setupOptionsPanelObserver(); // 启动选项面板监控
          setupFullscreenChangeListener(); // 监听全屏变化事件
          // 扫描现有消息注入按钮
          $('#chat > .mes').each(function () {
            if (typeof injectGalgameButton === 'function') {
              injectGalgameButton(this);
            }
          });
          // 如果开启则自动应用，并确保世界书存在
          if (isEnabled) {
            // 每次加载时检查并确保世界书存在（异步执行，不阻塞UI）
            injectCOTToWorldbook().catch(e => console.warn(`[${SCRIPT_NAME}] 世界书注入失败:`, e));
            enableWorldbookGlobally().catch(e => console.warn(`[${SCRIPT_NAME}] 世界书全局开启失败:`, e));
            applyGalgameMode();
            // 更新地点时间显示
            setTimeout(() => updateLocationTimeDisplay(), 500);

            if (settings.hideOtherFloors) hideNonLastFloors();
          }
          // 使用SillyTavern官方事件监听消息完成
          if (typeof topWindow.eventOn === 'function' && topWindow.tavern_events) {
            topWindow.eventOn(topWindow.tavern_events.MESSAGE_RECEIVED, messageId => {
              console.log(`[${SCRIPT_NAME}] MESSAGE_RECEIVED 事件触发, messageId: ${messageId}`);
              if (!isEnabled) return;
              // 延迟处理确保DOM更新
              setTimeout(() => {
                const mesNode = topWindow.document.querySelector(`.mes[mesid="${messageId}"]`);
                if (mesNode) {
                  // 检查内容是否包含Galgame标签
                  let content = getRawMessageContent(messageId);
                  if (!content) {
                    const $mesText = $(mesNode).find('.mes_text');
                    content = decodeHtml($mesText.html() || '');
                  }
                  const hasGalTags = /<(p|sprite|maintext|background)[^>]*>/i.test(content);
                  if (hasGalTags) {
                    processNewMessage(mesNode);
                  } else if (mesNode.classList.contains('gal-hidden')) {
                    // 如果生成完成但没有Galgame标签，且被隐藏了，则显示出来（处理OOC或错误情况）
                    mesNode.classList.remove('gal-hidden');
                    console.log(`[${SCRIPT_NAME}] 消息 ${messageId} 非Galgame格式，已解除隐藏`);
                  }
                }
              }, 200);
            });
            console.log(`[${SCRIPT_NAME}] MESSAGE_RECEIVED 事件监听已注册`);
            // 监听角色卡切换，更新开关状态
            topWindow.eventOn(topWindow.tavern_events.CHAT_CHANGED, () => {
              const newEnabled = isCurrentCharEnabled();
              if (newEnabled !== isEnabled) {
                isEnabled = newEnabled;
                updateButtonState();
                console.log(`[${SCRIPT_NAME}] 角色卡切换，Galgame模式: ${isEnabled ? '开' : '关'}`);
                if (isEnabled) {
                  applyGalgameMode();
                  if (settings.hideOtherFloors) hideNonLastFloors();
                } else {
                  restoreOriginalViews();
                }
              }
            });
            console.log(`[${SCRIPT_NAME}] CHAT_CHANGED 事件监听已注册`);
          }
        }, 1500); // 增加延迟确保角色卡已加载
        console.log(`[${SCRIPT_NAME}] v${VERSION} 初始化完成`);
      } catch (e) {
        console.error(`[${SCRIPT_NAME}] 初始化失败:`, e);
      }
    });
  }
  // 快进功能
  function startSkipping() {
    if (isSkipping) return;
    isSkipping = true;
    const $btn = $('#gal-global-overlay [data-action="skip"]');
    $btn.addClass('active');

    // ★ TTS: 快进开始时停止TTS播放
    TTSManager.stop();

    const doSkip = () => {
      var _a;
      if (!isSkipping) return;
      // ★ 关键修复：使用 .attr()
      const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
      const state = messageSegmentState.get(String(mesId));
      // console.log(`[${SCRIPT_NAME}] [DEBUG] 快进中: mesId=${mesId}, index=${state === null || state === void 0 ? void 0 : state.currentIndex}, total=${(_a = state === null || state === void 0 ? void 0 : state.segments) === null || _a === void 0 ? void 0 : _a.length}`);
      if (!state) {
        console.warn(`[${SCRIPT_NAME}] [DEBUG] 快进停止: 找不到状态`);
        stopSkipping();
        return;
      }
      // 尝试预判下一段是否存在
      const hasNext = !!state.segments[state.currentIndex + 1];
      if (hasNext) {
        // ★ TTS: 快进时停止当前播放
        TTSManager.stop();
        state.currentIndex++;
        updateOverlaySegmentDisplay(state);
        skipTimer = setTimeout(doSkip, settings.skipSpeed * 1000);
      } else {
        console.log(`[${SCRIPT_NAME}] [DEBUG] 快进停止: 已到最后`);
        stopSkipping();
        showToast('已快进到最后');
      }
    };
    doSkip();
  }
  function stopSkipping() {
    isSkipping = false;
    if (skipTimer) {
      clearTimeout(skipTimer);
      skipTimer = null;
    }
    $('#gal-global-overlay [data-action="skip"]').removeClass('active');
  }

  // 快退功能
  function startRewinding() {
    if (isRewinding) return;
    isRewinding = true;
    showToast('快速回退中...');

    const $btn = $('#gal-global-overlay [data-action="prev"]');
    $btn.addClass('active');

    const doRewind = () => {
      if (!isRewinding) return;

      const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
      const state = messageSegmentState.get(String(mesId));

      if (!state) {
        stopRewinding();
        return;
      }

      if (state.currentIndex > 0) {
        // ★ TTS: 快退时停止当前播放
        TTSManager.stop();
        state.currentIndex--;
        updateOverlaySegmentDisplay(state);
        rewindTimer = setTimeout(doRewind, settings.skipSpeed * 1000);
      } else {
        stopRewinding();
        showToast('已回退到开头');
      }
    };

    doRewind();
  }

  function stopRewinding() {
    isRewinding = false;
    if (rewindTimer) {
      clearTimeout(rewindTimer);
      rewindTimer = null;
    }
    $('#gal-global-overlay [data-action="prev"]').removeClass('active');
  }

  function triggerPrevSegment() {
    const mesId = $('#gal-global-overlay .gal-game-container').attr('data-mes-id');
    const state = messageSegmentState.get(String(mesId));
    if (!state) return;

    if (state.currentIndex > 0) {
      // ★ TTS: 切换前停止当前播放
      TTSManager.stop();
      state.currentIndex--;
      updateOverlaySegmentDisplay(state);
    } else {
      showToast('已是第一段');
    }
  }

  function showCustomPopupPanel(title, htmlContent) {
    // 移除已存在的
    $('#gal-custom-popup').remove();

    const $popup = $(`
            <div id="gal-custom-popup" class="gal-input-modal">
                <div class="gal-input-box" style="max-width: 600px; width: 90%; max-height: 80vh; overflow-y: auto;">
                    <div class="gal-input-title">
                        <span>${title}</span>
                        <button class="gal-popup-close" style="float: right; background: none; border: none; font-size: 1.5rem; cursor: pointer;">&times;</button>
                    </div>
                    <div class="gal-custom-content" style="padding: 15px;">
                        ${htmlContent}
                    </div>
                </div>
            </div>
        `);

    $(topWindow.document.body).append($popup);

    // 关闭事件
    $popup.find('.gal-popup-close').on('click', () => $popup.remove());
    $popup.on('click', function (e) {
      if (e.target === this) $popup.remove();
    });
  }
  // 键盘快捷键
  function setupKeyboardShortcuts() {
    $(topWindow.document).on('keydown', function (e) {
      if (!isEnabled) return;
      // 如果正在输入框内，不触发快捷键
      const activeEl = topWindow.document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable)) {
        return;
      }
      // Ctrl键快进
      if (e.key === 'Control' && settings.ctrlKeySkip) {
        startSkipping();
      }
      // 空格键
      if (e.code === 'Space' && settings.spaceKeyNext) {
        e.preventDefault();
        triggerNextSegment();
      }
      // 回车键
      if (e.code === 'Enter' && settings.enterKeyNext) {
        e.preventDefault();
        triggerNextSegment();
      }
    });
    $(topWindow.document).on('keyup', function (e) {
      if (e.key === 'Control' && settings.ctrlKeySkip) {
        stopSkipping();
      }
    });
    console.log(`[${SCRIPT_NAME}] 快捷键监听已启动`);
  }
  // 触发下一段 (找到最后一个可见的 Galgame 容器)
  function triggerNextSegment() {
    const $lastContainer = $('.gal-game-container:visible').last();
    if (!$lastContainer.length) return;
    const $nextBtn = $lastContainer.find('[data-action="next"]');
    if ($nextBtn.length) {
      $nextBtn.trigger('click');
    }
  }
  // 通用拖拽功能
  function makeDraggable($element, $handle) {
    $handle.addClass('gal-draggable-handle');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;
    $handle.on('mousedown touchstart', function (e) {
      // 排除关闭按钮等交互元素
      if ($(e.target).closest('button, input, a, .gal-config-close, .close').length) return;
      e.preventDefault();
      isDragging = true;
      const evt = e.type === 'touchstart' ? e.touches[0] : e;
      startX = evt.clientX;
      startY = evt.clientY;
      const offset = $element.offset();
      // 获取相对于窗口的位置
      initialLeft = offset.left;
      initialTop = offset.top;
      // 转换为 fixed 定位，保持当前视觉位置不变
      $element.css({
        position: 'fixed',
        margin: 0,
        left: initialLeft - $(topWindow).scrollLeft(),
        top: initialTop - $(topWindow).scrollTop(),
        transform: 'none', // 清除可能存在的transform居中
      });
    });
    $(topWindow).on('mousemove touchmove', function (e) {
      if (!isDragging) return;
      e.preventDefault(); // 防止滚动
      const evt = e.type === 'touchmove' ? e.touches[0] : e;
      const dx = evt.clientX - startX;
      const dy = evt.clientY - startY;
      $element.css({
        left: initialLeft - $(topWindow).scrollLeft() + dx,
        top: initialTop - $(topWindow).scrollTop() + dy,
      });
    });
    $(topWindow).on('mouseup touchend', function () {
      isDragging = false;
    });
  }
  // 启动
  if ($ && topWindow.document.readyState === 'complete') {
    init();
  } else {
    topWindow.addEventListener('load', init);
  }
})();
