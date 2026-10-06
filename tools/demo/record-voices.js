// 录制在线演示的台词语音：docs/public/demo/voice/{<hash>.mp3, voices.json}
// 打开真实酒馆，调用其中已配置好的小白X TTS（xiaobaixTts.synthesize，与插件朗读时走的是同一合成接口），
// 按各剧本（story.js、story-live2d.js）的 VOICE_PREFERENCES 给每个角色选用「我的音色」里的音色，逐句合成并保存。
// voices.json 只记录所用音色的名称 / 音色值 / resourceId（不含任何鉴权配置），供演示页模拟小白X 接口回放。
//
// 用法：ST_URL=http://酒馆地址:8000/ ST_USER=账号 ST_PASS=密码 npm run demo:voices
//   ST_USER / ST_PASS：酒馆开启了基础认证时需要；只从环境变量读取，不会写入任何文件
//   DEMO_VOICES="柚=音色名,丽华=音色名"：临时覆盖 VOICE_PREFERENCES
//   依赖 puppeteer-core 与本机 Chrome：PUPPETEER_CORE=puppeteer-core 所在路径，CHROME_PATH=Chrome 可执行文件
//   已录制的台词跳过（换了音色会重录），剧本里删掉的台词会清理对应文件
const esbuild = require('esbuild');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'docs/public/demo/voice');
const manifestFile = path.join(outDir, 'voices.json');

function loadScenarios() {
  const entry = path.join(os.tmpdir(), `galgame-demo-stories-entry-${process.pid}.js`);
  const outfile = path.join(os.tmpdir(), `galgame-demo-stories-${process.pid}.cjs`);
  fs.writeFileSync(entry, [
    `export { SCENARIO as main } from ${JSON.stringify(path.join(__dirname, 'story.js'))};`,
    `export { SCENARIO as live2d } from ${JSON.stringify(path.join(__dirname, 'story-live2d.js'))};`,
    `export { lineKey, collectDialogueLines } from ${JSON.stringify(path.join(__dirname, 'story-utils.js'))};`,
  ].join('\n'));
  esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'cjs', platform: 'node', outfile, logLevel: 'error' });
  try {
    return require(outfile);
  } finally {
    fs.rmSync(entry, { force: true });
    fs.rmSync(outfile, { force: true });
  }
}

function loadPuppeteer() {
  try {
    return require(process.env.PUPPETEER_CORE || 'puppeteer-core');
  } catch (error) {
    throw new Error('需要 puppeteer-core：npm i -g puppeteer-core 后用 PUPPETEER_CORE 指向其目录');
  }
}

function resolveVoicePreferences(scenarios) {
  const prefs = {};
  for (const scenario of scenarios) {
    for (const [character, voice] of Object.entries(scenario.VOICE_PREFERENCES || {})) {
      if (prefs[character] && prefs[character] !== voice) throw new Error(`角色「${character}」在不同剧本里指定了不同音色：${prefs[character]} / ${voice}`);
      prefs[character] = voice;
    }
  }
  for (const pair of String(process.env.DEMO_VOICES || '').split(',')) {
    const [character, voice] = pair.split('=').map(v => v && v.trim());
    if (character && voice) prefs[character] = voice;
  }
  return prefs;
}

function collectLines(mod, scenarios) {
  const lines = new Map();
  for (const scenario of scenarios) {
    for (const variant of scenario.NODE_VARIANTS) {
      for (const line of mod.collectDialogueLines(scenario.renderNode(variant.id, variant.params || {}))) {
        const key = mod.lineKey(line.text);
        if (!lines.has(key)) lines.set(key, { ...line, key });
      }
    }
  }
  return [...lines.values()];
}

function readManifest() {
  try {
    return JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  } catch (_) {
    return null;
  }
}

async function main() {
  const stUrl = process.env.ST_URL;
  if (!stUrl) throw new Error('请用 ST_URL 指定酒馆地址');
  const mod = loadScenarios();
  const scenarios = [mod.main, mod.live2d];
  const prefs = resolveVoicePreferences(scenarios);
  const lines = collectLines(mod, scenarios);
  const missingVoice = [...new Set(lines.map(l => l.speaker))].filter(name => !prefs[name]);
  if (missingVoice.length) throw new Error(`以下角色没有在 VOICE_PREFERENCES 中指定音色：${missingVoice.join('、')}`);

  const puppeteer = loadPuppeteer();
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: 'new',
    args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    if (process.env.ST_USER) await page.authenticate({ username: process.env.ST_USER, password: process.env.ST_PASS || '' });
    await page.goto(stUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => typeof window.xiaobaixTts?.synthesize === 'function', { timeout: 120000 })
      .catch(() => { throw new Error('酒馆中未找到小白X TTS（xiaobaixTts），请确认小白X 已安装并启用 TTS 模块'); });

    // 「我的音色」：小白X 的配置文件，只取音色条目的公开字段
    const speakers = await page.evaluate(async () => {
      const res = await fetch('/user/files/LittleWhiteBox_TTS.json', { cache: 'no-cache' });
      if (!res.ok) return [];
      const list = (await res.json())?.volc?.mySpeakers || [];
      return list.map(s => ({ name: s.name, value: s.value, source: s.source || null, resourceId: s.resourceId || null }));
    });
    const bindings = {};
    const usedSpeakers = [];
    for (const [character, voiceName] of Object.entries(prefs)) {
      const speaker = speakers.find(s => s.name === voiceName || s.value === voiceName);
      if (!speaker) throw new Error(`酒馆小白X「我的音色」里没有「${voiceName}」。可用：${speakers.map(s => s.name).join('、')}`);
      bindings[character] = speaker.name;
      if (!usedSpeakers.some(s => s.value === speaker.value)) usedSpeakers.push(speaker);
    }

    fs.mkdirSync(outDir, { recursive: true });
    const previous = readManifest();
    const lineFiles = {};
    let created = 0;
    for (const line of lines) {
      const speaker = speakers.find(s => s.name === bindings[line.speaker]);
      const file = `${crypto.createHash('sha1').update(`${speaker.value}|${line.key}`).digest('hex').slice(0, 12)}.mp3`;
      lineFiles[line.key] = file;
      const target = path.join(outDir, file);
      if (previous?.lines?.[line.key] === file && fs.existsSync(target) && fs.statSync(target).size > 0) continue;

      let lastError = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const result = await page.evaluate(async (text, voice) => {
          try {
            const blob = await window.xiaobaixTts.synthesize(text, { speaker: voice });
            const bytes = new Uint8Array(await blob.arrayBuffer());
            let binary = '';
            for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
            return { ok: true, type: blob.type, base64: btoa(binary) };
          } catch (error) {
            return { ok: false, error: String(error?.message || error) };
          }
        }, line.text, speaker.value);
        if (result.ok) {
          fs.writeFileSync(target, Buffer.from(result.base64, 'base64'));
          lastError = null;
          break;
        }
        lastError = result.error;
        await new Promise(r => setTimeout(r, 1500));
      }
      if (lastError) throw new Error(`合成失败「${line.speaker}：${line.text}」：${lastError}`);
      created++;
      console.log(`[voices] ${line.speaker}（${speaker.name}）${line.text}`);
    }

    const keep = new Set(Object.values(lineFiles));
    let removed = 0;
    for (const name of fs.readdirSync(outDir)) {
      if (name.endsWith('.mp3') && !keep.has(name)) {
        fs.rmSync(path.join(outDir, name));
        removed++;
      }
    }
    const manifest = { provider: 'littlewhitebox', speakers: usedSpeakers, bindings, lines: lineFiles };
    fs.writeFileSync(manifestFile, `${JSON.stringify(manifest, null, 1)}\n`, 'utf8');
    const total = [...keep].reduce((sum, name) => sum + fs.statSync(path.join(outDir, name)).size, 0);
    console.log(`[voices] ${lines.length} 句台词（新录制 ${created}，清理 ${removed}），共 ${(total / 1024).toFixed(0)} KB`);
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
