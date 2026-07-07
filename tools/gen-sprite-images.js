// 批量生成内置立绘（绿幕 → 后续 build-sprite-pack.js 抠图，离线一次性工具）
// 策略（表情表模式）：每角色一次生成 5×2 网格表情表（4K 16:9，一图 10 表情——同次生成天然一致），
//   以已验收的「默认」基准图为参考保持既定形象，切片为 10 张单表情图。
// 用法：
//   node tools/gen-sprite-images.js --samples            # 样张：每包角色的 默认/微笑/生气 + NPC「路人」（逐张模式）
//   node tools/gen-sprite-images.js                      # 全量：每角色一张表情表→切片 + 全部 NPC
//   node tools/gen-sprite-images.js --pack jp            # 只生成某包
//   node tools/gen-sprite-images.js --pack jp --only 学园少女 --force   # 重跑某角色表情表
// 产物：tmp/sprite-sheets/<包id>/<角色>.png（原表）+ tmp/sprite-raw/<包id>/<角色>_<表情>.png（切片）
// 环境变量：BG_GEN_BASE_URL / BG_GEN_MODEL 可覆盖

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const BASE_URL = process.env.BG_GEN_BASE_URL || 'https://reapi-mainzip--userae0aaf.replit.app/v1';
const API_KEY = process.env.BG_GEN_API_KEY || '613613';
const MODEL = process.env.BG_GEN_MODEL || 'google/gemini-3-pro-image';
// 表情表专用模型：gemini 排版不严格（网格不均/自画分隔线），gpt-5.4-image-2 指令遵循更好
const SHEET_MODEL = process.env.BG_GEN_SHEET_MODEL || 'openai/gpt-5.4-image-2';
const REQUEST_TIMEOUT_MS = 180000;
const RETRIES = 3;
const DELAY_BETWEEN_MS = 1500;
const MIN_BYTES = 500 * 1024; // 2K 竖图正图下限；低于视为低清预览

const ROOT = path.resolve(__dirname, '..');
const CHAR_FILE = path.join(__dirname, 'sprite-characters.json');
const RAW_DIR = path.join(ROOT, 'tmp', 'sprite-raw');
const SHEET_DIR = path.join(ROOT, 'tmp', 'sprite-sheets');

const SAMPLE_EXPRESSIONS = ['默认', '微笑', '生气'];

const args = process.argv.slice(2);
const getArg = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const hasFlag = name => args.includes(`--${name}`);
const onlyPack = getArg('pack');
const onlyKey = getArg('only'); // 形如 学园少女_微笑
const samplesMode = hasFlag('samples');
const force = hasFlag('force');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Node fetch 对该端点会被中途断开，统一走 curl 子进程
function curlPostJson(url, bodyObj) {
  const tmpReq = path.join(os.tmpdir(), `sprite-gen-req-${process.pid}.json`);
  const tmpResp = path.join(os.tmpdir(), `sprite-gen-resp-${process.pid}.json`);
  fs.writeFileSync(tmpReq, JSON.stringify(bodyObj));
  try {
    execFileSync(
      'curl',
      ['-s', '-m', String(Math.floor(REQUEST_TIMEOUT_MS / 1000)), '-X', 'POST', url,
        '-H', 'Content-Type: application/json', '-H', `Authorization: Bearer ${API_KEY}`,
        '--data-binary', `@${tmpReq}`, '-o', tmpResp],
      { stdio: 'pipe' },
    );
    const text = fs.readFileSync(tmpResp, 'utf8').trim();
    if (!text) throw new Error('空响应');
    return text;
  } finally {
    try { fs.unlinkSync(tmpReq); } catch {}
    try { fs.unlinkSync(tmpResp); } catch {}
  }
}

function describe(buf) {
  if (buf[0] === 0x89) return { ext: 'png', dims: `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}` };
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length - 9) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { ext: 'jpg', dims: `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}` };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
    return { ext: 'jpg', dims: '?' };
  }
  return { ext: 'png', dims: '?' };
}

function extractLargestImage(json) {
  const images = (json.choices?.[0]?.message?.images || [])
    .map(im => {
      const u = im?.image_url?.url || im?.url || '';
      const comma = u.indexOf(',');
      if (!u.startsWith('data:') || comma < 0) return null;
      return Buffer.from(u.slice(comma + 1), 'base64');
    })
    .filter(Boolean);
  if (!images.length) return null;
  images.sort((a, b) => b.length - a.length);
  return images[0];
}

// 参考图压到 768 宽 jpeg 再发送（2K 原图 base64 payload 过大会导致上游失败）
async function fileToRefDataUrl(p) {
  const sharp = require('sharp');
  const buf = await sharp(p).resize({ width: 768 }).jpeg({ quality: 88 }).toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

// 文生图（基准图 / NPC 剪影）
async function generateBase(prompt) {
  const text = curlPostJson(`${BASE_URL}/chat/completions`, {
    model: MODEL,
    messages: [{ role: 'user', content: `Generate a single image (portrait orientation): ${prompt}` }],
    image_config: { aspect_ratio: '9:16', image_size: '2K' },
  });
  const json = JSON.parse(text);
  if (json.error) throw new Error(`API 错误: ${JSON.stringify(json.error).slice(0, 300)}`);
  const buf = extractLargestImage(json);
  if (!buf) throw new Error(`返回无图片: ${String(json.choices?.[0]?.message?.content ?? '').slice(0, 200)}`);
  if (buf.length < MIN_BYTES) throw new Error(`图片过小(${(buf.length / 1024).toFixed(0)}KB)`);
  return buf;
}

// 程序生成精确 5×2 网格模板（绿底 + 品红分隔线），让模型"填格子"而非自行排版
async function buildGridTemplateDataUrl() {
  const sharp = require('sharp');
  const W = 1280, H = 720, LINE = 4;
  const px = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      // 默认纯绿
      let r = 0, g = 255, b = 0;
      // 竖线 x = W/5,2W/5,3W/5,4W/5；横线 y = H/2（品红 #FF00FF）
      const onV = [1, 2, 3, 4].some(k => Math.abs(x - (k * W) / 5) < LINE / 2);
      const onH = Math.abs(y - H / 2) < LINE / 2;
      if (onV || onH) { r = 255; g = 0; b = 255; }
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
  }
  const buf = await sharp(px, { raw: { channels: 3, width: W, height: H } }).png().toBuffer();
  return `data:image/png;base64,${buf.toString('base64')}`;
}

// 表情表：一图 10 表情（5×2 网格），gpt-5.4-image-2 + 网格模板图硬约束排版
async function generateSheet(basePath, sheetInstruction) {
  const content = [];
  content.push({ type: 'image_url', image_url: { url: await buildGridTemplateDataUrl() } });
  if (basePath) content.push({ type: 'image_url', image_url: { url: await fileToRefDataUrl(basePath) } });
  content.push({
    type: 'text',
    text:
      'The FIRST image is a layout template: a green canvas divided into exactly 10 equal cells (5 columns x 2 rows) by thin magenta guide lines. Recreate this image at high resolution, keeping the magenta guide lines EXACTLY in their original positions and thickness, and fill each cell with content as instructed. ' +
      (basePath ? 'The SECOND image is the character reference (keep identical design). ' : '') +
      sheetInstruction +
      ' Every cell must stay strictly inside its magenta boundaries; nothing may cross the guide lines. The image must be landscape 16:9.',
  });
  const text = curlPostJson(`${BASE_URL}/chat/completions`, {
    model: SHEET_MODEL,
    messages: [{ role: 'user', content }],
    image_config: { aspect_ratio: '16:9', image_size: '2K' }, // gpt-5.4-image-2 仅支持 1K/2K
  });
  const json = JSON.parse(text);
  if (json.error) throw new Error(`API 错误: ${JSON.stringify(json.error).slice(0, 300)}`);
  const buf = extractLargestImage(json);
  if (!buf) throw new Error(`返回无图片: ${String(json.choices?.[0]?.message?.content ?? '').slice(0, 200)}`);
  if (buf.length < 300 * 1024) throw new Error(`图片过小(${(buf.length / 1024).toFixed(0)}KB)，疑似低清`);
  return buf;
}

// 5×2 网格切片为 10 张单表情图（内缩 1.8% 边距，规避模型偶发画出的网格分隔线）
async function sliceSheet(sheetPath, outDir, charName, sheetOrder) {
  const sharp = require('sharp');
  const meta = await sharp(sheetPath).metadata();
  const cellW = Math.floor(meta.width / 5);
  const cellH = Math.floor(meta.height / 2);
  const insetX = Math.round(cellW * 0.018);
  const insetY = Math.round(cellH * 0.018);
  const results = [];
  for (let i = 0; i < 10; i++) {
    const col = i % 5, row = Math.floor(i / 5);
    const expName = sheetOrder[i];
    const outPath = path.join(outDir, `${charName}_${expName}.png`);
    await sharp(sheetPath)
      .extract({
        left: col * cellW + insetX,
        top: row * cellH + insetY,
        width: cellW - insetX * 2,
        height: cellH - insetY * 2,
      })
      .png()
      .toFile(outPath);
    results.push(outPath);
  }
  return results;
}

// 图生图编辑（表情差分：带基准图，只改表情）
async function generateDiff(basePath, instruction) {
  const refUrl = await fileToRefDataUrl(basePath);
  const text = curlPostJson(`${BASE_URL}/chat/completions`, {
    model: MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: refUrl } },
          { type: 'text', text: instruction },
        ],
      },
    ],
    image_config: { aspect_ratio: '9:16', image_size: '2K' },
  });
  const json = JSON.parse(text);
  if (json.error) throw new Error(`API 错误: ${JSON.stringify(json.error).slice(0, 300)}`);
  const buf = extractLargestImage(json);
  if (!buf) throw new Error(`返回无图片: ${String(json.choices?.[0]?.message?.content ?? '').slice(0, 200)}`);
  if (buf.length < MIN_BYTES) throw new Error(`图片过小(${(buf.length / 1024).toFixed(0)}KB)`);
  return buf;
}

function existingFile(outBase) {
  for (const ext of ['png', 'jpg', 'webp']) {
    const p = `${outBase}.${ext}`;
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function withRetry(fn, label) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      return await fn();
    } catch (e) {
      console.warn(`  重试 ${attempt}/${RETRIES} 失败: ${e.message.slice(0, 180)}`);
      if (attempt === RETRIES) throw e;
      await sleep(3000 * attempt);
    }
  }
}

function writeBuf(buf, outBase) {
  const { ext, dims } = describe(buf);
  const outPath = `${outBase}.${ext}`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, buf);
  return { outPath, dims, bytes: buf.length };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CHAR_FILE, 'utf8'));
  const packs = config.packs.filter(p => !onlyPack || p.id === onlyPack);
  if (!packs.length) {
    console.error(`未找到包: ${onlyPack}`);
    process.exit(1);
  }

  const expNames = samplesMode ? SAMPLE_EXPRESSIONS : Object.keys(config.expressions);
  let ok = 0, total = 0;
  const failed = [];

  for (const pack of packs) {
    const outDir = path.join(RAW_DIR, pack.id);

    // —— 角色 ——
    for (const [charName, anchor] of Object.entries(pack.characters)) {
      const baseKey = `${charName}_默认`;
      const baseOut = path.join(outDir, baseKey);
      const basePrompt = `${pack.style}, ${anchor}, neutral calm expression, ${config.greenscreen}, no text, no watermark, no logo`;

      if (samplesMode) {
        // 样张模式：逐张（基准 + 少量差分），供画风验收
        if (!onlyKey || onlyKey === baseKey) {
          total++;
          const existed = existingFile(baseOut);
          if (existed && !force) {
            console.log(`[跳过] ${pack.id}/${baseKey}`);
            ok++;
          } else {
            process.stdout.write(`[基准] ${pack.id}/${baseKey} ... `);
            try {
              const buf = await withRetry(() => generateBase(basePrompt));
              const r = writeBuf(buf, baseOut);
              console.log(`OK ${r.dims} ${(r.bytes / 1024 / 1024).toFixed(1)}MB`);
              ok++;
            } catch (e) {
              console.error(`失败: ${e.message.slice(0, 200)}`);
              failed.push(`${pack.id}/${baseKey}`);
            }
            await sleep(DELAY_BETWEEN_MS);
          }
        }
        const basePath = existingFile(baseOut);
        for (const expName of expNames) {
          if (expName === '默认') continue;
          const key = `${charName}_${expName}`;
          if (onlyKey && onlyKey !== key) continue;
          total++;
          const outBase = path.join(outDir, key);
          if (existingFile(outBase) && !force) {
            console.log(`[跳过] ${pack.id}/${key}`);
            ok++;
            continue;
          }
          if (!basePath) {
            console.error(`[缺基准] ${pack.id}/${key}`);
            failed.push(`${pack.id}/${key}`);
            continue;
          }
          process.stdout.write(`[差分] ${pack.id}/${key} ... `);
          try {
            const instruction = `${config.diffInstruction} ${config.expressions[expName]}. Output a single image.`;
            const buf = await withRetry(() => generateDiff(basePath, instruction));
            const r = writeBuf(buf, outBase);
            console.log(`OK ${r.dims} ${(r.bytes / 1024 / 1024).toFixed(1)}MB`);
            ok++;
          } catch (e) {
            console.error(`失败: ${e.message.slice(0, 200)}`);
            failed.push(`${pack.id}/${key}`);
          }
          await sleep(DELAY_BETWEEN_MS);
        }
        continue;
      }

      // 全量模式：一张 5×2 表情表 → 切片 10 张（同次生成天然一致）
      if (onlyKey && onlyKey !== charName) continue;
      total++;
      const sheetOut = path.join(SHEET_DIR, pack.id, `${charName}.png`);
      const allSlicesExist = config.sheetOrder.every(exp =>
        existingFile(path.join(outDir, `${charName}_${exp}`)),
      );
      if (allSlicesExist && !force) {
        console.log(`[跳过] ${pack.id}/${charName}（10 切片已存在）`);
        ok++;
        continue;
      }
      process.stdout.write(`[表情表] ${pack.id}/${charName} ... `);
      try {
        const basePath = existingFile(baseOut); // 已验收的基准图作参考（可无）
        const sheetInstruction = `${pack.style}. Character: ${anchor}. ${config.sheetInstruction}`;
        const buf = await withRetry(() => generateSheet(basePath, sheetInstruction));
        fs.mkdirSync(path.dirname(sheetOut), { recursive: true });
        fs.writeFileSync(sheetOut, buf);
        const { dims } = describe(buf);
        // 切片前清理旧的逐张产物（样张遗留），避免混入不同批次
        for (const exp of config.sheetOrder) {
          const old = existingFile(path.join(outDir, `${charName}_${exp}`));
          if (old) fs.unlinkSync(old);
        }
        fs.mkdirSync(outDir, { recursive: true });
        await sliceSheet(sheetOut, outDir, charName, config.sheetOrder);
        console.log(`OK ${dims} ${(buf.length / 1024 / 1024).toFixed(1)}MB → 已切 10 片`);
        ok++;
      } catch (e) {
        console.error(`失败: ${e.message.slice(0, 200)}`);
        failed.push(`${pack.id}/${charName}`);
      }
      await sleep(DELAY_BETWEEN_MS);
    }

    // —— NPC 剪影（仅「默认」；样张模式只出「路人」）——
    const npcNames = samplesMode ? ['路人'] : Object.keys(pack.npc || {});
    for (const npcName of npcNames) {
      const key = `${npcName}_默认`;
      if (onlyKey && onlyKey !== key) continue;
      total++;
      const outBase = path.join(outDir, key);
      const existed = existingFile(outBase);
      if (existed && !force) {
        console.log(`[跳过] ${pack.id}/${key}`);
        ok++;
        continue;
      }
      process.stdout.write(`[NPC] ${pack.id}/${key} ... `);
      try {
        const prompt = `${pack.npc[npcName]}, ${config.greenscreen}, no text, no watermark`;
        const buf = await withRetry(() => generateBase(prompt));
        const r = writeBuf(buf, outBase);
        console.log(`OK ${r.dims} ${(r.bytes / 1024 / 1024).toFixed(1)}MB`);
        ok++;
      } catch (e) {
        console.error(`失败: ${e.message.slice(0, 200)}`);
        failed.push(`${pack.id}/${key}`);
      }
      await sleep(DELAY_BETWEEN_MS);
    }
  }

  console.log(`\n完成 ${ok}/${total}${failed.length ? `，失败: ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
