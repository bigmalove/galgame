const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

// CSS 注入插件
const cssPlugin = {
  name: 'css-placeholder',
  setup(build) {
    build.onEnd(result => {
      if (result.errors.length > 0) return;

      const cssFile = path.join(__dirname, '数据库界面插件.css');
      const rawCss = fs.readFileSync(cssFile, 'utf8');

      // 压缩 CSS
      const minified = esbuild.transformSync(rawCss, {
        loader: 'css',
        minify: true,
      }).code;

      const distDir = path.join(__dirname, 'dist');

      // 内嵌 CSS 到 JS（转义反斜杠和反引号）
      const escaped = minified
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`');

      const outFile = path.join(distDir, '数据库界面插件.dist.js');
      let js = fs.readFileSync(outFile, 'utf8');
      js = js.replace('__CSS_PLACEHOLDER__', escaped);
      fs.writeFileSync(outFile, js, 'utf8');

    });
  },
};

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/index.js'],
  bundle: true,
  outfile: 'dist/数据库界面插件.dist.js',
  format: 'iife',
  target: ['es2020'],
  platform: 'browser',
  charset: 'utf8',

  // 不压缩，保持可读性
  minify: false,

  // 不做 tree-shaking（所有代码都需要，避免副作用函数被剔除）
  treeShaking: false,

  // 插件
  plugins: [cssPlugin],

  // sourcemap（开发阶段使用，发布时关闭）
  sourcemap: false,
};

if (isWatch) {
  esbuild.context(buildOptions).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else {
  esbuild.build(buildOptions).then(() => {
    console.log('Build complete!');
  }).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
