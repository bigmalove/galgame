// 构建在线演示：docs/public/demo/{index.html, live2d/index.html, demo-host.js, galgame-plugin.js}（台词语音 voice/ 由 npm run demo:voices 生成）
// - galgame-plugin.js：插件本体，入口与 esbuild 选项同 esbuild.config.js（仅额外压缩），CSS 同样内联
// - demo-host.js：模拟酒馆宿主 + 预置剧本（tools/demo/host.js；story.js 主演示、story-live2d.js Live2D 演示）
// 用法：npm run demo:build
const esbuild = require('esbuild');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'docs/public/demo');
const pkg = require(path.join(root, 'package.json'));

function readJpPack() {
  const src = fs.readFileSync(path.join(root, 'src/ui/builtin-bg-packs.js'), 'utf8');
  const m = src.match(/id:\s*'jp',[\s\S]*?repo:\s*'([^']+)',\s*tag:\s*'([^']+)'/);
  if (!m) throw new Error('无法从 builtin-bg-packs.js 读取日式学园图包信息');
  return { repo: m[1], tag: m[2] };
}

// 演示页面：同一个页面模板 + 同一个 demo-host.js，按 data-demo-scenario 选择剧本
const ABOUT_COMMON = `    <h3>关于本演示</h3>
    <p>页面加载的是插件本体的真实构建产物，由演示页模拟酒馆、酒馆助手与数据库插件提供的接口，AI 回复为预置剧本。存档 / 读档 / 时间线需要酒馆后端，演示中不可用。</p>
    <h3>语音与 Live2D</h3>
    <p>角色语音走插件的小白X TTS 引擎：台词固定，语音是在真实酒馆里用小白X（火山引擎豆包语音）预先录制的，演示页模拟小白X 接口回放给插件；音色绑定、Live2D 口型同步、切换台词时打断等仍是插件原有逻辑。点「开始游戏」后才会出声。</p>`;
const LIVE2D_LICENSE = '© Live2D Inc.，依 <a href="https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html" target="_blank" rel="noopener">Free Material License</a> 使用，从 Live2D 官方仓库加载';
const PAGES = [
  {
    file: 'index.html',
    scenario: 'main',
    title: '在线演示 · Galgame 界面插件',
    description: 'Galgame 界面插件在线演示：插件真实运行，背景转场、镜头、环境光、粒子特效、打字机、Live2D 与语音、多款皮肤。',
    veilTitle: '樱落之时',
    base: '',
    docs: '../',
    about: `${ABOUT_COMMON}
    <h3>素材来源</h3>
    <ul>
      <li>背景与立绘：插件内置图包「日式学园」</li>
      <li>Live2D 模型（小春）：Live2D 官方示例模型 Haru，${LIVE2D_LICENSE}</li>
      <li>语音：火山引擎豆包语音合成（柚：甜心小美 / 丽华：高冷御姐 / 小春：柔美女友）</li>
    </ul>`,
  },
  {
    file: 'live2d/index.html',
    scenario: 'live2d',
    title: 'Live2D 演示 · Galgame 界面插件',
    description: 'Galgame 界面插件 Live2D 演示：四个 Live2D 角色同台，Cubism 3 / 4 / 5 模型、表情映射、内置参数表情、自定义表情动作与语音口型同步，插件真实运行。',
    veilTitle: '星见之夜',
    base: '../',
    docs: '../../',
    about: `${ABOUT_COMMON}
    <h3>这一页看什么</h3>
    <ul>
      <li>小春（Haru · Cubism 3）：表情映射到模型自带表情</li>
      <li>日和（Hiyori · Cubism 4）：模型没有表情文件，插件自动改用内置参数表情</li>
      <li>真央（Mao · Cubism 5）：走插件的 Cubism 5 运行时；自定义表情「施法」映射到模型的魔法动作</li>
      <li>夏目老师（Natori）：不做任何配置，按表情名自动匹配</li>
      <li>说话人切换时非说话角色变暗失焦，口型随语音音量实时开合</li>
    </ul>
    <h3>素材来源</h3>
    <ul>
      <li>背景：插件内置图包「日式学园」</li>
      <li>Live2D 模型：Live2D 官方示例模型 Haru / Hiyori / Mao / Natori，${LIVE2D_LICENSE}</li>
      <li>语音：火山引擎豆包语音合成（小春：柔美女友 / 日和：爽快思思 / 真央：樱桃丸子 / 夏目：儒雅逸辰）</li>
    </ul>`,
  },
];

// 预合成台词语音清单（tools/demo/record-voices.js 生成），打进 demo-host.js
function readVoiceManifest() {
  const file = path.join(outDir, 'voice/voices.json');
  if (!fs.existsSync(file)) {
    console.warn('[demo] 未找到 docs/public/demo/voice/voices.json，演示中不启用 TTS（先运行 npm run demo:voices 录制台词语音）');
    return {};
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function inlineCss(file) {
  const rawCss = fs.readFileSync(path.join(root, '数据库界面插件.css'), 'utf8');
  const minified = esbuild.transformSync(rawCss, { loader: 'css', minify: true }).code;
  // 压缩后模板字符串会被改写成普通引号字符串，连同引号整体替换为 JSON 字符串字面量
  const js = fs.readFileSync(file, 'utf8');
  const re = /(["'`])__CSS_PLACEHOLDER__\1/;
  if (!re.test(js)) throw new Error('插件产物中找不到 __CSS_PLACEHOLDER__');
  fs.writeFileSync(file, js.replace(re, () => JSON.stringify(minified)), 'utf8');
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const pluginFile = path.join(outDir, 'galgame-plugin.js');
  await esbuild.build({
    entryPoints: [path.join(root, 'src/index.js')],
    bundle: true,
    outfile: pluginFile,
    format: 'iife',
    target: ['es2020'],
    platform: 'browser',
    charset: 'utf8',
    define: { __GALGAME_VERSION__: JSON.stringify(pkg.version) },
    minify: true,
    treeShaking: false,
    logLevel: 'warning',
  });
  inlineCss(pluginFile);

  const pluginHash = crypto.createHash('sha1').update(fs.readFileSync(pluginFile)).digest('hex').slice(0, 10);
  const hostFile = path.join(outDir, 'demo-host.js');
  await esbuild.build({
    entryPoints: [path.join(__dirname, 'host.js')],
    bundle: true,
    outfile: hostFile,
    format: 'iife',
    target: ['es2020'],
    platform: 'browser',
    charset: 'utf8',
    define: {
      __GALGAME_VERSION__: JSON.stringify(pkg.version),
      __DEMO_JP_PACK__: JSON.stringify(readJpPack()),
      __DEMO_BUILD_ID__: JSON.stringify(pluginHash),
      __DEMO_VOICES__: JSON.stringify(readVoiceManifest()),
    },
    minify: true,
    logLevel: 'warning',
  });

  const hostHash = crypto.createHash('sha1').update(fs.readFileSync(hostFile)).digest('hex').slice(0, 10);
  const template = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  for (const page of PAGES) {
    const values = {
      __SCENARIO__: page.scenario,
      __PAGE_TITLE__: page.title,
      __DESCRIPTION__: page.description,
      __VEIL_TITLE__: page.veilTitle,
      __ABOUT__: page.about,
      __BASE__: page.base,
      __DOCS__: page.docs,
      __CURRENT_MAIN__: page.scenario === 'main' ? ' aria-current="page"' : '',
      __CURRENT_LIVE2D__: page.scenario === 'live2d' ? ' aria-current="page"' : '',
      __BUILD_ID__: hostHash,
    };
    const html = template.replace(/__[A-Z0-9_]+__/g, token => (token in values ? values[token] : token));
    const target = path.join(outDir, page.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, html, 'utf8');
  }

  const size = f => `${(fs.statSync(path.join(outDir, f)).size / 1024).toFixed(0)} KB`;
  console.log(`[demo] built v${pkg.version} -> docs/public/demo (plugin ${size('galgame-plugin.js')}, host ${size('demo-host.js')})`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
