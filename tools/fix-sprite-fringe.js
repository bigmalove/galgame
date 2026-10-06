// 修复已打包立绘的品红残边（不需要绿幕原图，直接处理 webp/png，原尺寸写回以保持差分对齐）
// 用法：
//   node tools/fix-sprite-fringe.js <目录或文件...> [--dry-run] [--quality 85]
//   例：node tools/fix-sprite-fringe.js ../galgame-bg-jp/sprites --dry-run
// 目录会递归处理 .webp / .png；未检出残条的文件不改动。修完记得同步重做缩略图（sprite-thumbs）。

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { removeEdgeMagenta } = require('./lib/magenta-fringe');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const qIdx = args.indexOf('--quality');
const quality = qIdx >= 0 ? Number(args[qIdx + 1]) || 85 : 85;
const inputs = args.filter((a, i) => !a.startsWith('--') && !(qIdx >= 0 && i === qIdx + 1));

if (!inputs.length) {
  console.log('用法: node tools/fix-sprite-fringe.js <目录或文件...> [--dry-run] [--quality 85]');
  process.exit(1);
}

function collectFiles(p) {
  const stat = fs.statSync(p);
  if (stat.isFile()) return /\.(webp|png)$/i.test(p) ? [p] : [];
  return fs.readdirSync(p).flatMap(name => collectFiles(path.join(p, name)));
}

(async () => {
  const files = inputs.flatMap(collectFiles);
  let fixed = 0;
  for (const file of files) {
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const result = removeEdgeMagenta(data, info.width, info.height);
    if (!result.cleared) continue;
    fixed++;
    console.log(`${dryRun ? '[检出]' : '[修复]'} ${file}: ${result.columns.length} 列 / ${result.cleared} 像素`);
    if (dryRun) continue;
    const out = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
    const buf = /\.png$/i.test(file) ? await out.png().toBuffer() : await out.webp({ quality }).toBuffer();
    fs.writeFileSync(file, buf);
  }
  console.log(`\n共 ${files.length} 个文件，${dryRun ? '检出' : '修复'} ${fixed} 个`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
