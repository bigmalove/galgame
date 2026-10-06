// 构建在线演示：docs/public/demo/{index.html, demo-host.js, galgame-plugin.js}
// - galgame-plugin.js：插件本体，入口与 esbuild 选项同 esbuild.config.js（仅额外压缩），CSS 同样内联
// - demo-host.js：模拟酒馆宿主 + 预置剧本（tools/demo/host.js）
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
    },
    minify: true,
    logLevel: 'warning',
  });

  const hostHash = crypto.createHash('sha1').update(fs.readFileSync(hostFile)).digest('hex').slice(0, 10);
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/__BUILD_ID__/g, hostHash);
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');

  const size = f => `${(fs.statSync(path.join(outDir, f)).size / 1024).toFixed(0)} KB`;
  console.log(`[demo] built v${pkg.version} -> docs/public/demo (plugin ${size('galgame-plugin.js')}, host ${size('demo-host.js')})`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
