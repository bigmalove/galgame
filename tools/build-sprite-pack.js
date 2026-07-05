// 立绘打包工具：绿幕原图 → chroma-key 抠图（含 despill）→ 差分对齐裁切 → alpha webp + manifest
// 用法：
//   node tools/build-sprite-pack.js --pack jp --owner bigmalove --tag v1.2.0 [--out tmp/bg-packs]
//   node tools/build-sprite-pack.js --all --owner bigmalove --tag v1.2.0
//   node tools/build-sprite-pack.js --preview --pack jp   # 只抠图出棋盘格质检图（tmp/sprite-samples/），不写包
// 输入：tmp/sprite-raw/<包id>/<角色>_<表情>.png|jpg
// 输出：<out>/<repo>/sprites/*.webp + sprite-thumbs/*.webp，并把 sprites 数组合并进 remote_assets.json

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CHAR_FILE = path.join(__dirname, 'sprite-characters.json');
const RAW_DIR = path.join(ROOT, 'tmp', 'sprite-raw');
const SAMPLES_DIR = path.join(ROOT, 'tmp', 'sprite-samples');

const SPRITE_HEIGHT = 1536;
const SPRITE_QUALITY = 85;
const SPRITE_MAX_BYTES = 400 * 1024;
const THUMB_HEIGHT = 200;

const args = process.argv.slice(2);
const getArg = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const hasFlag = name => args.includes(`--${name}`);

const owner = getArg('owner');
const tag = getArg('tag') || 'v1.2.0';
const outRoot = path.resolve(ROOT, getArg('out') || path.join('tmp', 'bg-packs'));
const onlyPackId = getArg('pack');
const buildAll = hasFlag('all');
const previewMode = hasFlag('preview');

if (!previewMode && !owner) {
  console.error('缺少 --owner <github用户名>（或用 --preview 只出质检图）');
  process.exit(1);
}
if (!onlyPackId && !buildAll) {
  console.error('请指定 --pack <包id> 或 --all');
  process.exit(1);
}

// ============ chroma-key 抠图 ============
// 绿幕判定：G 显著高于 R/B（经典 green dominance）；软边缘按超出量渐变 alpha；despill 压制残留绿
function chromaKeyToAlpha(data, width, height) {
  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 3], g = data[i * 3 + 1], b = data[i * 3 + 2];
    const maxRB = Math.max(r, b);
    const dominance = g - maxRB; // 绿超出量
    let alpha;
    if (dominance > 96) alpha = 0;               // 强绿：全透明
    else if (dominance > 24) alpha = Math.round(255 * (1 - (dominance - 24) / 72)); // 软边缘渐变
    else alpha = 255;                             // 前景
    let og = g;
    if (alpha > 0 && alpha < 255) og = Math.min(g, Math.round((r + b) / 2)); // despill：半透明边缘压绿
    else if (alpha === 255 && dominance > 8) og = Math.min(g, maxRB + 8);    // 前景轻微去溢色
    out[i * 4] = r;
    out[i * 4 + 1] = og;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = alpha;
  }
  return out;
}

async function keyOutFile(inputPath) {
  const { data, info } = await sharp(inputPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = chromaKeyToAlpha(data, info.width, info.height);
  return { rgba, width: info.width, height: info.height };
}

// alpha>16 的最小包围盒
function boundingBox(rgba, width, height) {
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (rgba[(y * width + x) * 4 + 3] > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

function unionBox(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

async function rgbaToSharp(rgba, width, height) {
  return sharp(rgba, { raw: { channels: 4, width, height } });
}

function listRawByCharacter(packId) {
  const dir = path.join(RAW_DIR, packId);
  if (!fs.existsSync(dir)) return new Map();
  const groups = new Map(); // charName -> [{expression, file}]
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)_([^_.]+)\.(png|jpe?g|webp)$/i);
    if (!m) continue;
    const [, charName, expression] = m;
    if (!groups.has(charName)) groups.set(charName, []);
    groups.get(charName).push({ expression, file: path.join(dir, f) });
  }
  return groups;
}

function encodePath(rel) {
  return rel.split('/').map(encodeURIComponent).join('/');
}

async function encodeSpriteWebp(sharpInst) {
  let quality = SPRITE_QUALITY;
  let buf;
  for (;;) {
    buf = await sharpInst.clone().webp({ quality }).toBuffer();
    if (buf.length <= SPRITE_MAX_BYTES || quality <= 60) break;
    quality -= 7;
  }
  return { buf, quality };
}

async function processPack(pack, config) {
  const groups = listRawByCharacter(pack.id);
  if (!groups.size) {
    console.warn(`[${pack.id}] 无原图，跳过`);
    return { spriteEntries: [], processed: [] };
  }

  const repo = pack.repo;
  const cdnBase = owner ? `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${tag}/` : '';
  const packDir = path.join(outRoot, repo);
  const spriteDir = path.join(packDir, 'sprites');
  const thumbDir = path.join(packDir, 'sprite-thumbs');
  if (!previewMode) {
    fs.mkdirSync(spriteDir, { recursive: true });
    fs.mkdirSync(thumbDir, { recursive: true });
  }

  const spriteEntries = [];
  const processed = []; // 供质检图使用 {charName, expression, sharp}

  console.log(`\n=== ${pack.id}（${groups.size} 个角色/NPC）===`);
  for (const [charName, items] of groups) {
    // 1) 全部抠图 + 求并集 box（同角色差分统一裁切框 → 表情切换不跳动）
    const keyed = [];
    let union = null;
    for (const it of items) {
      const { rgba, width, height } = await keyOutFile(it.file);
      const box = boundingBox(rgba, width, height);
      if (!box) {
        console.warn(`  [警告] ${charName}_${it.expression} 抠图后为空，跳过`);
        continue;
      }
      keyed.push({ ...it, rgba, width, height, box });
      union = unionBox(union, box);
    }
    if (!keyed.length) continue;

    // 并集 box 加 2% 边距
    const padX = Math.round((union.maxX - union.minX) * 0.02);
    const padY = Math.round((union.maxY - union.minY) * 0.02);
    const crop = {
      left: Math.max(0, union.minX - padX),
      top: Math.max(0, union.minY - padY),
    };
    crop.width = Math.min(keyed[0].width, union.maxX + padX) - crop.left;
    crop.height = Math.min(keyed[0].height, union.maxY + padY) - crop.top;

    // 2) 裁切→缩放→编码
    for (const it of keyed) {
      const inst = (await rgbaToSharp(it.rgba, it.width, it.height))
        .extract(crop)
        .resize({ height: SPRITE_HEIGHT });
      const resizedBuf = await inst.png().toBuffer(); // 中间态（质检/再编码共用）
      const resized = sharp(resizedBuf);
      processed.push({ charName, expression: it.expression, pngBuf: resizedBuf });

      if (!previewMode) {
        const name = `${charName}_${it.expression}.webp`;
        const { buf, quality } = await encodeSpriteWebp(resized);
        fs.writeFileSync(path.join(spriteDir, name), buf);
        const thumbBuf = await resized.clone().resize({ height: THUMB_HEIGHT }).webp({ quality: 75 }).toBuffer();
        fs.writeFileSync(path.join(thumbDir, name), thumbBuf);
        spriteEntries.push({
          characterId: charName,
          expression: it.expression,
          url: cdnBase + encodePath(`sprites/${name}`),
          thumb: cdnBase + encodePath(`sprite-thumbs/${name}`),
          // 主角立绘是「模板」：导入图包时不自动入库，仅供用户创建角色时套用；
          // 路人剪影是功能性回退素材，直接入库（sprite-manager 按固定名自动查找）
          template: !/^路人/.test(charName),
        });
        console.log(`  [打包] ${charName}_${it.expression}: ${(buf.length / 1024).toFixed(0)}KB (q${quality})`);
      } else {
        console.log(`  [抠图] ${charName}_${it.expression} OK`);
      }
    }
  }

  // 3) manifest 合并（保留 backgrounds 等原字段）
  if (!previewMode && spriteEntries.length) {
    const manifestPath = path.join(packDir, 'remote_assets.json');
    const manifest = fs.existsSync(manifestPath)
      ? JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      : { packageName: pack.id, backgrounds: [] };
    manifest.version = tag.replace(/^v/, '');
    manifest.sprites = spriteEntries;
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`  manifest 已更新: sprites × ${spriteEntries.length}`);
  }

  return { spriteEntries, processed };
}

// 棋盘格质检拼图（验证透明与差分对齐）
async function buildContactSheet(packId, processed) {
  if (!processed.length) return;
  const CELL_W = 300, CELL_H = 480, COLS = Math.min(6, processed.length);
  const rows = Math.ceil(processed.length / COLS);

  // 棋盘格底
  const checker = Buffer.alloc(CELL_W * CELL_H * 3);
  for (let y = 0; y < CELL_H; y++) {
    for (let x = 0; x < CELL_W; x++) {
      const v = ((x >> 4) + (y >> 4)) % 2 ? 200 : 150;
      const i = (y * CELL_W + x) * 3;
      checker[i] = checker[i + 1] = checker[i + 2] = v;
    }
  }
  const checkerCell = await sharp(checker, { raw: { channels: 3, width: CELL_W, height: CELL_H } }).png().toBuffer();

  const composites = [];
  for (let i = 0; i < processed.length; i++) {
    const left = (i % COLS) * CELL_W;
    const top = Math.floor(i / COLS) * CELL_H;
    composites.push({ input: checkerCell, left, top });
    const spriteBuf = await sharp(processed[i].pngBuf).resize({ height: CELL_H - 20, fit: 'inside' }).png().toBuffer();
    const meta = await sharp(spriteBuf).metadata();
    composites.push({ input: spriteBuf, left: left + Math.round((CELL_W - meta.width) / 2), top: top + 10 });
  }
  fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  const outPath = path.join(SAMPLES_DIR, `sheet-sprite-${packId}.png`);
  await sharp({ create: { width: CELL_W * COLS, height: CELL_H * rows, channels: 3, background: '#333' } })
    .composite(composites)
    .png()
    .toFile(outPath);
  console.log(`  质检图: ${path.relative(ROOT, outPath)}（顺序: ${processed.map(p => `${p.charName}_${p.expression}`).join('、')}）`);
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CHAR_FILE, 'utf8'));
  const packs = config.packs.filter(p => buildAll || p.id === onlyPackId);
  if (!packs.length) {
    console.error(`未找到包: ${onlyPackId}`);
    process.exit(1);
  }
  for (const pack of packs) {
    const { processed } = await processPack(pack, config);
    // 质检图主角与 NPC 分开出（NPC 是独立生成/独立分组打包的，质检也独立验收）
    const mains = processed.filter(p => !/^路人/.test(p.charName));
    const npcs = processed.filter(p => /^路人/.test(p.charName));
    await buildContactSheet(pack.id, mains);
    if (npcs.length) await buildContactSheet(`${pack.id}-npc`, npcs);
  }
  console.log('\n完成');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
