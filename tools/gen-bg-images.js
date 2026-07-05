// 批量生成内置背景图包素材（离线一次性工具，不进入插件运行时）
// 已验证路由：chat/completions + image_config {aspect_ratio:'16:9', image_size:'2K'}
//   模型 google/gemini-3-pro-image-preview 返回 2 张图（1376x768 预览 + 2752x1536 正图），取最大者。
// 用法：
//   node tools/gen-bg-images.js                          # 全量生成 64 张（tmp/bg-raw/<包id>/<场景>.png|jpg）
//   node tools/gen-bg-images.js --samples                # 仅生成四包各 1 张样张（tmp/bg-samples/）
//   node tools/gen-bg-images.js --pack jp                # 只生成某个包
//   node tools/gen-bg-images.js --pack jp --only 教室    # 只重跑某个场景
//   node tools/gen-bg-images.js --force                  # 已存在也重新生成
// 环境变量可覆盖：BG_GEN_BASE_URL / BG_GEN_MODEL

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const BASE_URL =
  process.env.BG_GEN_BASE_URL ||
  'https://8000-f9w6uq284kkj2y32h32mha3ebaf2z1ruyzm3o8ao0pagb4ycodb.tunnel.runloop.ai/v1';
const MODEL = process.env.BG_GEN_MODEL || 'google/gemini-3-pro-image-preview';
const REQUEST_TIMEOUT_MS = 180000;
const RETRIES = 3;
const DELAY_BETWEEN_MS = 1500;
const MIN_BYTES = 1024 * 1024; // 2K 正图应 >1MB；小于此值视为只拿到低清预览，重试

const ROOT = path.resolve(__dirname, '..');
const SCENES_FILE = path.join(__dirname, 'bg-scenes.json');
const RAW_DIR = path.join(ROOT, 'tmp', 'bg-raw');
const SAMPLES_DIR = path.join(ROOT, 'tmp', 'bg-samples');

const args = process.argv.slice(2);
const getArg = name => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : null;
};
const hasFlag = name => args.includes(`--${name}`);

const onlyPack = getArg('pack');
const onlyScene = getArg('only');
const samplesMode = hasFlag('samples');
const force = hasFlag('force');

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// 注：此环境中 Node 原生 fetch 对该端点会被中途断开（curl 正常），故用 curl 子进程请求
function curlPostJson(url, bodyObj) {
  const tmpReq = path.join(os.tmpdir(), `bg-gen-req-${process.pid}.json`);
  const tmpResp = path.join(os.tmpdir(), `bg-gen-resp-${process.pid}.json`);
  fs.writeFileSync(tmpReq, JSON.stringify(bodyObj));
  try {
    execFileSync(
      'curl',
      ['-s', '-m', String(Math.floor(REQUEST_TIMEOUT_MS / 1000)), '-X', 'POST', url,
        '-H', 'Content-Type: application/json', '--data-binary', `@${tmpReq}`, '-o', tmpResp],
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

function pngDims(buf) {
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

function jpgDims(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) {
      i++;
      continue;
    }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return '?';
}

function describe(buf) {
  if (buf[0] === 0x89) return { ext: 'png', dims: pngDims(buf) };
  if (buf[0] === 0xff && buf[1] === 0xd8) return { ext: 'jpg', dims: jpgDims(buf) };
  return { ext: 'png', dims: '?' };
}

async function generateOne(prompt) {
  const text = curlPostJson(`${BASE_URL}/chat/completions`, {
    model: MODEL,
    messages: [{ role: 'user', content: `Generate a single image (landscape 16:9): ${prompt}` }],
    image_config: { aspect_ratio: '16:9', image_size: '2K' },
  });
  const json = JSON.parse(text);
  if (json.error) throw new Error(`API 错误: ${JSON.stringify(json.error).slice(0, 300)}`);
  const images = (json.choices?.[0]?.message?.images || [])
    .map(im => {
      const u = im?.image_url?.url || im?.url || '';
      const comma = u.indexOf(',');
      if (!u.startsWith('data:') || comma < 0) return null;
      return Buffer.from(u.slice(comma + 1), 'base64');
    })
    .filter(Boolean);
  if (!images.length) {
    const content = String(json.choices?.[0]?.message?.content ?? '');
    throw new Error(`返回中无图片: ${content.slice(0, 200)}`);
  }
  images.sort((a, b) => b.length - a.length);
  const buf = images[0];
  if (buf.length < MIN_BYTES) throw new Error(`图片过小(${(buf.length / 1024).toFixed(0)}KB)，疑似低清预览`);
  return buf;
}

async function generateToFile(prompt, outBase) {
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const buf = await generateOne(prompt);
      const { ext, dims } = describe(buf);
      const outPath = `${outBase}.${ext}`;
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, buf);
      return { outPath, dims, bytes: buf.length };
    } catch (e) {
      console.warn(`  重试 ${attempt}/${RETRIES} 失败: ${e.message.slice(0, 200)}`);
      if (attempt === RETRIES) throw e;
      await sleep(3000 * attempt);
    }
  }
}

function existingFile(outBase) {
  for (const ext of ['png', 'jpg', 'webp']) {
    const p = `${outBase}.${ext}`;
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function main() {
  const config = JSON.parse(fs.readFileSync(SCENES_FILE, 'utf8'));
  const suffix = config.styleSuffix;
  const packs = config.packs.filter(p => !onlyPack || p.id === onlyPack);
  if (!packs.length) {
    console.error(`未找到包: ${onlyPack}`);
    process.exit(1);
  }

  const jobs = [];
  for (const pack of packs) {
    const sceneNames = samplesMode ? [pack.sample] : Object.keys(pack.scenes);
    for (const sceneName of sceneNames) {
      if (onlyScene && sceneName !== onlyScene) continue;
      const outDir = samplesMode ? SAMPLES_DIR : path.join(RAW_DIR, pack.id);
      const outBase = path.join(outDir, samplesMode ? `${pack.id}-${sceneName}` : sceneName);
      const prompt = [pack.stylePrefix, pack.scenes[sceneName], suffix].filter(Boolean).join(' ');
      jobs.push({ pack, sceneName, outBase, prompt });
    }
  }

  console.log(`共 ${jobs.length} 张待生成（模型 ${MODEL}，2K 16:9）`);
  let ok = 0;
  const failed = [];
  for (const job of jobs) {
    const existed = existingFile(job.outBase);
    if (existed && !force) {
      console.log(`[跳过] ${job.pack.id}/${job.sceneName}（已存在 ${path.basename(existed)}）`);
      ok++;
      continue;
    }
    process.stdout.write(`[生成] ${job.pack.id}/${job.sceneName} ... `);
    try {
      const r = await generateToFile(job.prompt, job.outBase);
      console.log(`OK ${r.dims} ${(r.bytes / 1024 / 1024).toFixed(1)}MB`);
      ok++;
    } catch (e) {
      console.error(`失败: ${e.message.slice(0, 200)}`);
      failed.push(`${job.pack.id}/${job.sceneName}`);
    }
    await sleep(DELAY_BETWEEN_MS);
  }

  console.log(`\n完成 ${ok}/${jobs.length}${failed.length ? `，失败: ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
