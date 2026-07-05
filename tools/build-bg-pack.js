// 内置背景图包打包工具：原图 → 2K webp + 缩略图 + remote_assets.json
// 用法：
//   node tools/build-bg-pack.js --pack jp --owner <github用户名> [--tag v1.0.0] [--out tmp/bg-packs]
//   node tools/build-bg-pack.js --all --owner <github用户名>
// 输入：tmp/bg-raw/<包id>/<场景名>.png|jpg（gen-bg-images.js 的产物）
// 输出：<out>/<repo>/backgrounds/<场景名>.webp + thumbs/<场景名>.webp + remote_assets.json + LICENSE + CREDITS.md + README.md

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SCENES_FILE = path.join(__dirname, 'bg-scenes.json');
const RAW_DIR = path.join(ROOT, 'tmp', 'bg-raw');

const BG_WIDTH = 2560;
const BG_HEIGHT = 1440;
const BG_QUALITY = 82;
const BG_MAX_BYTES = 800 * 1024;
const THUMB_WIDTH = 320;
const THUMB_HEIGHT = 180;
const THUMB_QUALITY = 70;

const args = process.argv.slice(2);
const getArg = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const hasFlag = name => args.includes(`--${name}`);

const owner = getArg('owner');
const tag = getArg('tag') || 'v1.0.0';
const outRoot = path.resolve(ROOT, getArg('out') || path.join('tmp', 'bg-packs'));
const onlyPackId = getArg('pack');
const buildAll = hasFlag('all');

if (!owner) {
  console.error('缺少 --owner <github用户名>');
  process.exit(1);
}
if (!onlyPackId && !buildAll) {
  console.error('请指定 --pack <包id> 或 --all');
  process.exit(1);
}

function findRawImage(packId, sceneName) {
  for (const ext of ['png', 'jpg', 'jpeg', 'webp']) {
    const p = path.join(RAW_DIR, packId, `${sceneName}.${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function encodePath(rel) {
  return rel.split('/').map(encodeURIComponent).join('/');
}

async function compressBackground(inputPath, outPath) {
  let quality = BG_QUALITY;
  let buf;
  for (;;) {
    buf = await sharp(inputPath)
      .resize(BG_WIDTH, BG_HEIGHT, { fit: 'cover', position: 'centre' })
      .webp({ quality })
      .toBuffer();
    if (buf.length <= BG_MAX_BYTES || quality <= 55) break;
    quality -= 6;
  }
  fs.writeFileSync(outPath, buf);
  return { bytes: buf.length, quality };
}

async function makeThumb(inputPath, outPath) {
  const buf = await sharp(inputPath)
    .resize(THUMB_WIDTH, THUMB_HEIGHT, { fit: 'cover', position: 'centre' })
    .webp({ quality: THUMB_QUALITY })
    .toBuffer();
  fs.writeFileSync(outPath, buf);
  return buf.length;
}

function checkCrossPackDuplicates(packs) {
  const seen = new Map();
  let conflict = false;
  for (const pack of packs) {
    for (const sceneName of Object.keys(pack.scenes)) {
      if (seen.has(sceneName)) {
        console.error(`场景名冲突: "${sceneName}" 同时出现在 ${seen.get(sceneName)} 与 ${pack.id}`);
        conflict = true;
      }
      seen.set(sceneName, pack.id);
    }
  }
  return !conflict;
}

async function buildPack(pack) {
  const repo = pack.repo;
  const packDir = path.join(outRoot, repo);
  const bgDir = path.join(packDir, 'backgrounds');
  const thumbDir = path.join(packDir, 'thumbs');
  fs.mkdirSync(bgDir, { recursive: true });
  fs.mkdirSync(thumbDir, { recursive: true });

  const cdnBase = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${tag}/`;
  const backgrounds = [];
  const missing = [];
  let totalBytes = 0;

  console.log(`\n=== ${pack.name}（${repo}）===`);
  for (const sceneName of Object.keys(pack.scenes)) {
    const rawPath = findRawImage(pack.id, sceneName);
    if (!rawPath) {
      missing.push(sceneName);
      console.warn(`[缺原图] ${sceneName}`);
      continue;
    }
    const bgOut = path.join(bgDir, `${sceneName}.webp`);
    const thumbOut = path.join(thumbDir, `${sceneName}.webp`);
    const bg = await compressBackground(rawPath, bgOut);
    const thumbBytes = await makeThumb(rawPath, thumbOut);
    totalBytes += bg.bytes + thumbBytes;
    backgrounds.push({
      sceneName,
      url: cdnBase + encodePath(`backgrounds/${sceneName}.webp`),
      thumb: cdnBase + encodePath(`thumbs/${sceneName}.webp`),
      file: `backgrounds/${sceneName}.webp`,
    });
    console.log(`[打包] ${sceneName}: ${(bg.bytes / 1024).toFixed(0)}KB (q${bg.quality}) + 缩略图 ${(thumbBytes / 1024).toFixed(0)}KB`);
  }

  const manifest = {
    packageName: pack.name,
    version: tag.replace(/^v/, ''),
    style: pack.id,
    exportDate: new Date().toISOString(),
    backgrounds,
  };
  fs.writeFileSync(path.join(packDir, 'remote_assets.json'), JSON.stringify(manifest, null, 2));

  fs.writeFileSync(
    path.join(packDir, 'LICENSE'),
    `CC0 1.0 Universal\n\n本仓库全部背景图片由 AI 生成（模型: google/gemini-3-pro-image-preview），\n发布者在法律允许的最大范围内放弃所有版权及相关权利。\n您可以自由复制、修改、分发本仓库内容（包括商业用途），无需署名。\n\nTo the extent possible under law, the publisher has waived all copyright\nand related or neighboring rights to these images (CC0 1.0).\nhttps://creativecommons.org/publicdomain/zero/1.0/\n`,
  );

  const sceneList = backgrounds.map(b => b.sceneName).join('、');
  fs.writeFileSync(
    path.join(packDir, 'CREDITS.md'),
    `# 素材来源\n\n- 生成方式：AI 文生图（google/gemini-3-pro-image-preview，2K 16:9，写实电影感风格）\n- 生成日期：${new Date().toISOString().slice(0, 10)}\n- 后期处理：sharp 裁切至 ${BG_WIDTH}×${BG_HEIGHT} webp（q${BG_QUALITY} 起自适应）\n- 许可证：CC0 1.0（见 LICENSE）\n`,
  );

  fs.writeFileSync(
    path.join(packDir, 'README.md'),
    `# ${pack.name}\n\ngalgame 界面插件内置背景图包（${backgrounds.length} 个场景，2K webp）。\n\n## 场景清单\n\n${sceneList}\n\n## 在插件中使用\n\n资源管理器 → 导入 → 内置背景图包，或手动「导入远程链接JSON」填入：\n\n\`\`\`\n${cdnBase}remote_assets.json\n\`\`\`\n\n## 许可证\n\nCC0 1.0，AI 生成素材，可自由使用与再分发。\n`,
  );

  console.log(
    `完成 ${backgrounds.length}/${Object.keys(pack.scenes).length} 场景，总计 ${(totalBytes / 1024 / 1024).toFixed(1)}MB${missing.length ? `；缺原图: ${missing.join('、')}` : ''}`,
  );
  return { repo, count: backgrounds.length, missing, totalBytes };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(SCENES_FILE, 'utf8'));
  if (!checkCrossPackDuplicates(config.packs)) process.exit(1);

  const packs = config.packs.filter(p => buildAll || p.id === onlyPackId);
  if (!packs.length) {
    console.error(`未找到包: ${onlyPackId}`);
    process.exit(1);
  }

  const results = [];
  for (const pack of packs) {
    results.push(await buildPack(pack));
  }

  console.log('\n=== 汇总 ===');
  for (const r of results) {
    console.log(`${r.repo}: ${r.count} 场景, ${(r.totalBytes / 1024 / 1024).toFixed(1)}MB${r.missing.length ? `, 缺 ${r.missing.length} 张` : ''}`);
  }
  console.log(`\n产物目录: ${outRoot}`);
  console.log('下一步: 为每个包建 GitHub 仓库 → push → 打 tag → 浏览器验证 remote_assets.json 可访问');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
