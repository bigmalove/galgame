// 生成 D&D 风格纹理素材（羊皮纸 + 深木纹）
// 使用纯 Node.js Buffer 生成 BMP，无需任何依赖

const fs = require('fs');

// --- 简单的 BMP 创建 ---
function createBMP(width, height, pixels) {
  const rowSize = Math.ceil(width * 3 / 4) * 4;
  const imageSize = rowSize * height;
  const fileSize = 54 + imageSize;
  const buf = Buffer.alloc(fileSize);

  // BMP Header
  buf.write('BM', 0);
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // offset
  // DIB Header
  buf.writeUInt32LE(40, 14);
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // top-down
  buf.writeUInt16LE(1, 26);
  buf.writeUInt16LE(24, 28); // 24bpp
  buf.writeUInt32LE(imageSize, 34);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 3;
      const dstIdx = 54 + y * rowSize + x * 3;
      buf[dstIdx] = pixels[srcIdx + 2];     // B
      buf[dstIdx + 1] = pixels[srcIdx + 1]; // G
      buf[dstIdx + 2] = pixels[srcIdx];     // R
    }
  }
  return buf;
}

// --- Perlin-like noise (简单实现) ---
function hash(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return (h ^ (h >> 16)) & 0x7fffffff;
}
function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const n00 = hash(ix, iy) / 0x7fffffff;
  const n10 = hash(ix + 1, iy) / 0x7fffffff;
  const n01 = hash(ix, iy + 1) / 0x7fffffff;
  const n11 = hash(ix + 1, iy + 1) / 0x7fffffff;
  return (n00 * (1 - sx) + n10 * sx) * (1 - sy) + (n01 * (1 - sx) + n11 * sx) * sy;
}
function fbm(x, y, octaves = 6) {
  let val = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += smoothNoise(x * freq, y * freq) * amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val;
}

// --- 1. 羊皮纸纹理 (400x300) ---
function generateParchment(w, h) {
  const pixels = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n1 = fbm(x / 80, y / 80, 6);
      const n2 = fbm(x / 30 + 100, y / 30 + 100, 4) * 0.3;
      const n = n1 + n2;

      // 边缘渐暗（模拟羊皮纸老化边缘）
      const ex = Math.min(x, w - x) / (w * 0.3);
      const ey = Math.min(y, h - y) / (h * 0.3);
      const edge = Math.min(1, Math.min(ex, ey));
      const edgeDarken = 0.7 + 0.3 * edge;

      // 基色: 温暖的羊皮纸色 (216, 200, 168) 到 (190, 170, 135)
      const base = 0.7 + n * 0.3;
      const r = Math.min(255, Math.max(0, Math.round((190 + 30 * base) * edgeDarken)));
      const g = Math.min(255, Math.max(0, Math.round((168 + 32 * base) * edgeDarken)));
      const b = Math.min(255, Math.max(0, Math.round((130 + 35 * base) * edgeDarken)));

      const idx = (y * w + x) * 3;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }
  return pixels;
}

// --- 2. 深色木纹纹理 (400x300) ---
function generateWood(w, h) {
  const pixels = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 木纹: 沿 Y 方向拉伸的噪声
      const grain = fbm(x / 15, y / 120 + 50, 5);
      const ring = Math.sin((x / 8 + grain * 8) * 0.5) * 0.5 + 0.5;
      const n = fbm(x / 60 + 200, y / 60 + 200, 4);
      const detail = 0.6 + ring * 0.25 + n * 0.15;

      // 基色: 深棕色 (42, 26, 14) 到 (65, 42, 24)
      const r = Math.min(255, Math.max(0, Math.round(35 + 30 * detail)));
      const g = Math.min(255, Math.max(0, Math.round(20 + 22 * detail)));
      const b = Math.min(255, Math.max(0, Math.round(10 + 14 * detail)));

      const idx = (y * w + x) * 3;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }
  return pixels;
}

// --- 3. 暗铁/金属纹理 (200x60) ---
function generateMetal(w, h) {
  const pixels = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = fbm(x / 10 + 300, y / 10 + 300, 4);
      const brushed = Math.sin(x / 2 + n * 3) * 0.03;
      const detail = 0.7 + n * 0.2 + brushed;

      // 基色: 暗铁色 (52, 40, 32) 到 (74, 58, 46)
      const r = Math.min(255, Math.max(0, Math.round(42 + 32 * detail)));
      const g = Math.min(255, Math.max(0, Math.round(32 + 26 * detail)));
      const b = Math.min(255, Math.max(0, Math.round(24 + 22 * detail)));

      const idx = (y * w + x) * 3;
      pixels[idx] = r;
      pixels[idx + 1] = g;
      pixels[idx + 2] = b;
    }
  }
  return pixels;
}

// --- 生成并保存 ---
const W = 400, H = 300;

console.log('生成羊皮纸纹理...');
const parchmentPixels = generateParchment(W, H);
const parchmentBmp = createBMP(W, H, parchmentPixels);
const parchmentB64 = parchmentBmp.toString('base64');

console.log('生成深色木纹纹理...');
const woodPixels = generateWood(W, H);
const woodBmp = createBMP(W, H, woodPixels);
const woodB64 = woodBmp.toString('base64');

console.log('生成暗铁金属纹理...');
const metalPixels = generateMetal(200, 60);
const metalBmp = createBMP(200, 60, metalPixels);
const metalB64 = metalBmp.toString('base64');

// 输出为 JS 常量文件
const output = `// 自动生成的 D&D 风格纹理素材 (base64 BMP)
// 由 generate-textures.js 生成

export const PARCHMENT_TEXTURE = 'data:image/bmp;base64,${parchmentB64}';
export const WOOD_TEXTURE = 'data:image/bmp;base64,${woodB64}';
export const METAL_TEXTURE = 'data:image/bmp;base64,${metalB64}';
`;

fs.writeFileSync('./src/ui/dnd-textures.js', output);
console.log('已保存到 src/ui/dnd-textures.js');
console.log(`  羊皮纸: ${(parchmentB64.length / 1024).toFixed(1)} KB`);
console.log(`  木纹:   ${(woodB64.length / 1024).toFixed(1)} KB`);
console.log(`  金属:   ${(metalB64.length / 1024).toFixed(1)} KB`);
