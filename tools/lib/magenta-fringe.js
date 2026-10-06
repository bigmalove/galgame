// 去除立绘左右边缘的品红残条
// 表情表用「绿底 + 品红 #FF00FF 分隔线」网格模板约束模型排版（gen-sprite-images.js），
// 模型偶尔把竖向分隔线画偏/画粗，切片时 1.8% 内缩没切干净；而 chroma-key 只去绿，品红线就作为
// 不透明色条留在立绘左右边缘（日式学园包 v1.3.0 实测 22/103 张）。
// 做法：只在左右边缘带内按列检测——分隔线是贯穿整格的竖线，品红覆盖率高的列判定为残条列；
// 残条列清除品红 / 半透明 / 低饱和混色（品红+绿 混出的灰），相邻 2 列只清品红与半透明像素。
// 不做全图连通填充：那会沿透明背景走到角色轮廓，误删洋红色衣饰。

function isMagentaish(r, g, b) {
  return r > 140 && b > 140 && g < Math.min(r, b) - 70;
}

/**
 * @param {Buffer|Uint8Array} rgba RGBA 像素（原地修改）
 * @param {number} width
 * @param {number} height
 * @param {{ band?: number, minCoverage?: number }} [options] band 边缘带宽（占宽度比例），minCoverage 判定残条列的品红覆盖率
 * @returns {{ columns: number[], cleared: number }}
 */
function removeEdgeMagenta(rgba, width, height, { band = 0.04, minCoverage = 0.3 } = {}) {
  const bandPx = Math.max(2, Math.round(width * band));
  const inBand = x => x >= 0 && x < width && (x < bandPx || x >= width - bandPx);
  const candidates = [];
  for (let x = 0; x < bandPx; x++) candidates.push(x);
  for (let x = Math.max(bandPx, width - bandPx); x < width; x++) candidates.push(x);

  const lineColumns = candidates.filter(x => {
    let count = 0;
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4;
      if (rgba[o + 3] > 0 && isMagentaish(rgba[o], rgba[o + 1], rgba[o + 2])) count++;
    }
    return count >= height * minCoverage;
  });
  if (!lineColumns.length) return { columns: [], cleared: 0 };

  const lineSet = new Set(lineColumns);
  const neighborSet = new Set();
  for (const x of lineColumns) {
    for (let d = -2; d <= 2; d++) {
      const nx = x + d;
      if (d !== 0 && inBand(nx) && !lineSet.has(nx)) neighborSet.add(nx);
    }
  }

  let cleared = 0;
  const clearColumn = (x, strict) => {
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4;
      const a = rgba[o + 3];
      if (a === 0) continue;
      const r = rgba[o], g = rgba[o + 1], b = rgba[o + 2];
      const lowSat = Math.max(r, g, b) - Math.min(r, g, b) < 40;
      if (isMagentaish(r, g, b) || a < 250 || (strict && lowSat)) {
        rgba[o + 3] = 0;
        cleared++;
      }
    }
  };
  lineSet.forEach(x => clearColumn(x, true));
  neighborSet.forEach(x => clearColumn(x, false));
  return { columns: lineColumns, cleared };
}

module.exports = { removeEdgeMagenta, isMagentaish };
