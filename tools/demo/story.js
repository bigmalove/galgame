// 在线演示的预置剧本：每个节点就是一条「AI 回复」原文，格式与 COT 世界书要求 AI 输出的完全一致，
// 由插件的真实解析/渲染管线处理（parseGalgameContent → updateGlobalOverlayContent）。
// summary 模拟「数据库」插件总结表的一行（插件「剧情回顾」读取它）；
// location/time 模拟「数据库」插件全局数据表里的当前地点/时间（插件顶部地点栏、时间栏读取它）；
// options 模拟「数据库」插件的选项表（AutoCardUpdaterAPI）：[选项文本, 去向]；选项值就是文本本身，
// 和数据库插件一样由插件拼成「<user>选项。」填进输入框发送，宿主再按文本找回去向。

export const USER_NAME = '学长';
export const CHAR_NAME = '柚';

// 立绘：演示开始前把内置日式学园图包的立绘模板套用到剧中角色（等同于在「上传立绘 → 内置模板」里手动套用）
export const SPRITE_TEMPLATES = [
  { character: '柚', template: '栗发温柔学妹' },
  { character: '丽华', template: '金发大小姐' },
];

// Live2D 角色：远程模型 URL 绑定到角色（等同于在「Live2D 模型来源 → 远程 URL」里填写），模型为 Live2D 官方示例 Haru。
// expressionMapping / motionMapping 即 Live2D 设置弹窗里的「表情映射」：剧本表情标签 → 模型自带表情 / 动作
export const LIVE2D_CHARACTERS = [
  {
    character: '小春',
    modelUrl: 'https://cdn.jsdelivr.net/gh/Live2D/CubismWebSamples@develop/Samples/Resources/Haru/Haru.model3.json',
    config: {
      transform: { offsetX: 0, offsetY: 170, scale: 1.2, scaleBase: 'height' },
      // Haru 自带表情：F01 微笑 / F02 柔和 / F03 严肃 / F04 担心 / F05 眯眼笑 / F06 平静睁眼 / F07 脸红 / F08 鼓气
      expressionMapping: { '默认': 'F02', '微笑': 'F01', '大笑': 'F05', '害羞': 'F07', '思考': 'F04', '难过': 'F04', '惊讶': 'F06', '生气': 'F08', '嘲讽': 'F03' },
      motionMapping: {},
    },
  },
];

// TTS 配音：台词语音由 tools/demo/record-voices.js 在真实酒馆里调用小白X TTS（火山引擎豆包语音）录制，
// 音色名取自酒馆中小白X 的「我的音色」，结果写入 docs/public/demo/voice/voices.json
export const VOICE_PREFERENCES = {
  柚: '甜心小美（多情感）',
  丽华: '高冷御姐（多情感）',
  小春: '柔美女友（多情感）',
};

const SMS = '丽华: 今晚的夜樱祭，你没忘吧？\n丽华: 七点，神社鸟居下。\n丽华: 迟到的话——后果自负哦。';

export const NODES = {
  greeting: {
    summary: '放学后的樱花道上，柚追上学长，邀他一起绕远路回家；图书委员小春提醒他去图书馆取伞；丽华发来短信，约他七点去夜樱祭。',
    location: '樱花道',
    time: '四月 · 放学后 16:40',
    text: `<maintext>
<background scene="樱花道" transition="black" />
<pixiPerform name="cherryBlossoms" />
<pixiPerform name="bokeh" />
<弹窗一><b>樱花道</b><br>从学校通往车站的必经之路，四月里两侧的染井吉野会同时盛开。</弹窗一>
<弹窗二><b>四月 · 放学后</b><br>16:40 · 晴 · 微风</弹窗二>
<p>四月的风把最后一节课的困意吹散了。通往车站的樱花道上，花瓣落得像一场不肯停歇的小雪。</p>
<p>身后传来一阵急促的脚步声，还有一声熟悉的、带着喘息的呼唤。</p>
<p>柚[惊讶]: "学长——！等、等一下嘛！"</p>
<p>柚[害羞]: "呼……总算追上了。今天的花开得这么好，一个人走回去的话，总觉得有点可惜呢。"</p>
<p>柚[微笑]: "那个……如果学长不赶时间的话，要不要陪我绕一点远路？"</p>
<p>话音刚落，一个抱着几本书的女生从樱花树下走来，在我们面前停下了脚步。</p>
<p>小春[微笑]: "学长，找到你了。上周借走的那把伞，还挂在图书馆的伞架上哦。"</p>
<p>小春[思考]: "天气预报说今晚会有雷阵雨……记得在闭馆前来拿。"</p>
<sprite action="exit" character="小春" />
<p>她朝柚轻轻点了点头，抱着书走回了校舍的方向。</p>
<p>柚[生气]: "……图书委员的小春学姐？学长连伞都借到她那里去了呀。"</p>
<p>就在这时，口袋里的手机震了一下。</p>
<styled type="手机短信" from="丽华" to="${USER_NAME}">${SMS}</styled>
<p>柚[思考]: "……又是谁的消息呀？学长今天可真受欢迎呢。"</p>
</maintext>`,
    options: [
      ['陪柚绕远路，去河堤看夕阳', 'riverbank'],
      ['回复丽华：“我这就去夜樱祭”', 'festival'],
      ['先去便利店买两罐汽水，边走边想', 'store'],
      ['回图书馆找小春拿伞', 'library'],
    ],
  },

  riverbank: {
    summary: '学长陪柚在河堤看夕阳，两人互相打趣；天色骤变，雷阵雨倾盆而下。',
    location: '河堤',
    time: '黄昏 17:20',
    text: `<maintext>
<background scene="河堤" />
<pixiPerform name="dust" />
<pixiPerform name="bokeh" />
<弹窗一><b>河堤</b><br>沿河的长堤，能看见铁桥和整片晚霞，是放学后散步的好去处。</弹窗一>
<弹窗二><b>黄昏</b><br>17:20 · 晴转阴 · 西边有积雨云</弹窗二>
<p>我们沿着河堤慢慢走。夕阳把河面染成一整片融化的金色，远处的电车拖着长长的影子驶过铁桥。</p>
<p>柚[微笑]: "嘿嘿，学长果然会选我这边。"</p>
<p>柚[害羞]: "……啊，不是那个意思！我是说，这里的夕阳真的很好看，想让学长也看看而已。"</p>
<p>柚[大笑]: "噗——学长你脸红了！明明是我先说错话的，为什么是学长在脸红呀？"</p>
<p>风忽然变凉了。西边的天空不知何时压上一层铅灰色的云，远处传来一声闷雷。</p>
<pixiPerform name="rain" />
<pixiPerform name="lightning" />
<p>第一滴雨落下时，第二滴、第三滴已经连成了线。</p>
<pixiPerform name="screenShake" />
<p>柚[惊讶]: "呀！？好近的雷……学、学长！"</p>
</maintext>`,
    options: [
      ['脱下外套罩住柚，冲去车站避雨', 'station'],
      ['拉着柚的手，一起跑向车站', 'station'],
    ],
  },

  festival: {
    summary: '学长赶到夜樱祭，换上浴衣的丽华嫌他迟到却还是拉他逛摊位；突如其来的雷雨打断了祭典。',
    location: '神社 · 夜樱祭',
    time: '夜 19:02',
    text: `<maintext>
<background scene="夏日祭" transition="iris" />
<pixiPerform name="fireflies" />
<pixiPerform name="bokeh" />
<弹窗一><b>神社 · 夜樱祭</b><br>每年只有一晚的祭典，参道两侧挂满灯笼，摊位一直摆到鸟居外。</弹窗一>
<弹窗二><b>夜</b><br>19:02 · 多云 · 有雷阵雨预警</弹窗二>
<p>跑到神社时，天已经完全黑了。参道两旁的灯笼一盏接一盏亮起来，空气里混着苹果糖和炭火的甜香。</p>
<p>丽华[嘲讽]: "两分钟。你迟到了整整两分钟。"</p>
<p>丽华[生气]: "本小姐特意换了浴衣等你，你倒好——是不是又被哪个学妹缠住了？"</p>
<p>丽华[害羞]: "……哼，算了。既然来了，就陪我把这条街逛完。捞金鱼、射击、苹果糖，一样都不许少。"</p>
<p>丽华[大笑]: "怎么，看呆了？这件浴衣可是限定款哦，你今天运气不错。"</p>
<pixiPerform name="lightning" />
<p>夜空忽然被一道白光劈开。人群里响起一阵惊呼，豆大的雨点紧跟着砸在了灯笼上。</p>
<pixiPerform name="rain" />
<pixiPerform name="screenShake" />
<p>丽华[惊讶]: "等——雷阵雨！？天气预报明明说今晚是晴天！"</p>
</maintext>`,
    options: [
      ['把丽华护在身后，往车站跑', 'station'],
      ['脱下外套顶在两人头上，冲向车站', 'station'],
    ],
  },

  store: {
    summary: '学长和柚去便利店买汽水，电视里的天气预报说今晚有强雷阵雨。',
    location: '车站前便利店',
    time: '傍晚 16:58',
    text: `<maintext>
<background scene="便利店" transition="wipe" />
<弹窗一><b>便利店</b><br>车站前的便利店，冰柜里永远有桃子味汽水。</弹窗一>
<弹窗二><b>傍晚</b><br>16:58 · 晴 · 天气预报：夜间强雷阵雨</弹窗二>
<p>自动门“叮咚”一声滑开，冷气扑面而来。冰柜里的汽水排得整整齐齐，像一列五颜六色的小士兵。</p>
<p>柚[搞怪]: "学长～我要桃子味的！……啊，学长你是在逃避选择吧？"</p>
<p>柚[微笑]: "没关系哦，我会等学长想清楚的。不过汽水要学长请客。"</p>
<p>结账时，店里的电视正在播报天气：“今晚局部地区将有强雷阵雨，请市民注意出行安全——”</p>
<p>柚[思考]: "雷阵雨……那丽华学姐那边的夜樱祭，会不会……"</p>
</maintext>`,
    options: [
      ['还是陪柚去河堤看夕阳', 'riverbank'],
      ['赶去夜樱祭找丽华', 'festival'],
    ],
  },

  library: {
    summary: '学长回图书馆找小春取伞；闭馆前雷雨骤至，小春提议两人撑同一把伞去车站。',
    location: '图书馆',
    time: '傍晚 17:05',
    text: `<maintext>
<background scene="图书馆" />
<pixiPerform name="dust" />
<弹窗一><b>图书馆</b><br>旧校舍顶层的图书馆，高窗朝西，闭馆时间 17:30。</弹窗一>
<弹窗二><b>傍晚</b><br>17:05 · 阴 · 雷阵雨将至</弹窗二>
<p>闭馆前的图书馆安静得只听得见翻书声。夕阳从高窗斜照进来，光柱里浮着细细的尘埃。</p>
<p>小春[微笑]: "来得正好，再晚五分钟，我就要锁门了。"</p>
<p>小春[默认]: "伞在这里。……伞柄上的挂坠是我顺手系上的，总觉得空着有点寂寞。"</p>
<p>小春[害羞]: "不、不喜欢的话可以摘掉的！我真的只是……顺手而已。"</p>
<p>窗外忽然暗了下来。远处滚过一声闷雷，玻璃窗上很快爬满了雨痕。</p>
<pixiPerform name="rain" />
<pixiPerform name="lightning" />
<p>小春[惊讶]: "真的下起来了……比天气预报说的还要早。"</p>
<p>小春[思考]: "这把伞，撑两个人应该够吧……我是说，学长要去车站的话，我们正好顺路。"</p>
</maintext>`,
    options: [
      ['和小春撑同一把伞去车站', 'ending-koharu'],
      ['把伞留给小春，自己冒雨跑去车站', 'ending-koharu-rain'],
    ],
  },

  station: {
    summary: '躲雨的车站里，柚和丽华撞了个正着，两人一齐逼问学长到底想和谁一起回家。',
    location: '车站',
    time: '夜 19:30 · 雷雨',
    text: ({ from }) => `<maintext>
<background scene="车站" transition="strips" />
<pixiPerform name="rain" />
<pixiPerform name="fog" />
<弹窗一><b>车站</b><br>小站的候车长椅只有一排，屋檐下挤满了躲雨的人。</弹窗一>
<弹窗二><b>夜</b><br>19:30 · 雷雨 · 末班车 21:10</弹窗二>
<p>${from === 'festival'
      ? '我护着丽华冲进车站。她的浴衣下摆溅满了泥点，却还是倔强地仰着下巴。'
      : '我们一路跑进车站的屋檐下。柚紧紧攥着我的衣角，额前的刘海湿成了一缕一缕。'}</p>
<p>然后，我们同时愣住了——候车长椅上，坐着另一个同样浑身湿透的人。</p>
<p>柚[惊讶]: "……丽华学姐？"</p>
<p>丽华[嘲讽]: "哎呀，这不是柚吗。原来放学后的‘绕远路’，是绕到这里来了？"</p>
<p>柚[生气]: "我、我才没有！是学长……是学长自己要陪我的！"</p>
<p>丽华[生气]: "哈？明明是本小姐先约的人！"</p>
<pixiPerform name="lightning" />
<pixiPerform name="screenShake" />
<p>一道惊雷在头顶炸开。两个人同时缩了一下，又同时瞪向了我。</p>
<p>柚[害羞]: "学长……今天，你到底想和谁一起回家？"</p>
<p>丽华[害羞]: "……我也想听。说清楚，不许含糊。"</p>
</maintext>`,
    options: [
      ['“雨停之前，我们三个一起等吧。”', 'ending-all'],
      ['把唯一的那把伞递给柚', 'ending-yuzu'],
      ['把唯一的那把伞递给丽华', 'ending-reika'],
    ],
  },

  ending: {
    summary: '雨过天晴的第二天，天台上的午休。',
    location: '天台',
    time: '次日 · 午休 12:30',
    text: ({ route }) => `<maintext>
<background scene="天台" transition="black" />
<pixiPerform name="cherryBlossoms" />
<pixiPerform name="dust" />
<弹窗一><b>天台</b><br>午休时间几乎没人上来，栏杆边能看到整片操场。</弹窗一>
<弹窗二><b>次日 · 午休</b><br>12:30 · 雨后放晴</弹窗二>
<p>第二天的天空干净得像被雨洗过一遍。天台的栏杆上还挂着水珠，在阳光里一闪一闪。</p>
${{
    yuzu: `<p>柚[害羞]: "昨天的伞……谢谢学长。今天换我请学长喝汽水吧？桃子味的，我记得学长也喜欢。"</p>
<p>柚[微笑]: "还有，下次绕远路的时候——也要叫上我哦。"</p>`,
    reika: `<p>丽华[害羞]: "昨天的伞……我会还你的。别误会，本小姐只是不喜欢欠人情。"</p>
<p>丽华[微笑]: "顺便一提，下周的烟火大会，你没得选。"</p>`,
    koharu: `<p>小春[微笑]: "昨天一起撑伞走到车站，学长的左肩全湿了吧？……我都看见了。"</p>
<p>小春[害羞]: "所以今天的便当，多做了一份。伞上的挂坠，你也没有摘呢。"</p>`,
    'koharu-rain': `<p>小春[生气]: "昨天明明说好顺路的，学长却一个人冲进了雨里……感冒了怎么办。"</p>
<p>小春[微笑]: "伞我先替你保管着。下次下雨，要记得来图书馆找我哦。"</p>`,
    all: `<p>柚[大笑]: "结果昨天三个人挤在长椅上，一直等到了末班车……学长的外套，我已经洗干净啦！"</p>
<p>丽华[害羞]: "……夜樱祭你欠我一次。下次，三个人一起去也……也不是不行。"</p>`,
  }[route] || ''}
<styled type="便签" from="演示说明">这是 Galgame 界面插件的在线演示。\n画面与语音全部由插件真实运行产生：背景转场、镜头运动、环境光、粒子特效、打字机、Live2D 与口型同步、皮肤，和你在酒馆里看到的一模一样。\n点右上角「插件设置」可以切换皮肤、特效和演出选项。</styled>
<p>—— 演示结束，感谢游玩 ——</p>
</maintext>`,
    options: [
      ['重新开始，换个选择看看', 'restart'],
    ],
  },

  // 自由输入（非选项）时的回复：演示模式下剧情固定，复述当前选项
  freeform: {
    text: ({ input }) => `<maintext>
<p>（你说：“${input}”）</p>
<p>演示模式下，AI 的回复是预置剧本，自由输入不会改变剧情走向。点击选项继续吧～</p>
</maintext>`,
  },
};

// 选项去向 → 下一个节点与参数（lastRoute：上一个分支节点，用于车站开场白）
export function resolveNextNode(target, { lastRoute } = {}) {
  if (['riverbank', 'festival', 'store', 'library'].includes(target)) return { id: target, params: {} };
  if (target === 'station') return { id: 'station', params: { from: lastRoute === 'festival' ? 'festival' : 'riverbank' } };
  if (target === 'ending-yuzu') return { id: 'ending', params: { route: 'yuzu' } };
  if (target === 'ending-reika') return { id: 'ending', params: { route: 'reika' } };
  if (target === 'ending-all') return { id: 'ending', params: { route: 'all' } };
  if (target === 'ending-koharu') return { id: 'ending', params: { route: 'koharu' } };
  if (target === 'ending-koharu-rain') return { id: 'ending', params: { route: 'koharu-rain' } };
  if (target === 'restart') return { id: 'restart', params: {} };
  return null;
}

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

// 全部可能出现的「节点 + 参数」组合（record-voices.js 据此收集需要预合成语音的台词）
export const NODE_VARIANTS = [
  { id: 'greeting' },
  { id: 'riverbank' },
  { id: 'festival' },
  { id: 'store' },
  { id: 'library' },
  { id: 'station', params: { from: 'riverbank' } },
  { id: 'station', params: { from: 'festival' } },
  ...['yuzu', 'reika', 'all', 'koharu', 'koharu-rain'].map(route => ({ id: 'ending', params: { route } })),
];

export function renderNode(id, params = {}) {
  const node = NODES[id];
  if (!node) return '';
  return typeof node.text === 'function' ? node.text(params) : node.text;
}
