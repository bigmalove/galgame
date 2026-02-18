import { SCRIPT_NAME } from '../core/constants.js';
import { saveLive2DModel } from '../db/live2d-models.js';
import { Live2DLoader } from './loader.js';
import {
  LIVE2D_RUNTIME_TYPES,
  inferCubismVersionFromModelJson,
  resolveRuntimeTypeFromCubismVersion,
} from './runtime-router.js';

// ============================================
// Live2D 模型上传器
// ============================================
export const Live2DUploader = {
  JSZip: null,

  async _loadJSZip() {
    if (this.JSZip) return this.JSZip;

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;

    if (_topWindow.JSZip) {
      this.JSZip = _topWindow.JSZip;
      return this.JSZip;
    }

    return new Promise((resolve, reject) => {
      const script = _topWindow.document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js';
      script.onload = () => {
        this.JSZip = _topWindow.JSZip;
        console.log(`[${SCRIPT_NAME}] JSZip 加载完成`);
        resolve(this.JSZip);
      };
      script.onerror = () => reject(new Error('JSZip 加载失败'));
      _topWindow.document.head.appendChild(script);
    });
  },

  async uploadZip(file, characterId) {
    const JSZip = await this._loadJSZip();

    console.log(`[${SCRIPT_NAME}] Live2DUploader: 开始解析 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    const zip = await JSZip.loadAsync(file);

    const modelJsonEntry = await this._findModelJson(zip);
    if (!modelJsonEntry) {
      throw new Error('未找到 Live2D 模型配置（model3.json / model.json / *.model.json / model*.json）');
    }

    const modelDir = modelJsonEntry.path.substring(0, modelJsonEntry.path.lastIndexOf('/') + 1);
    const modelJsonText = await modelJsonEntry.file.async('text');
    const modelJson = JSON.parse(modelJsonText);

    const entryPathLower = String(modelJsonEntry.path || '').toLowerCase();
    const isModel3 =
      entryPathLower.endsWith('model3.json') ||
      !!modelJson?.FileReferences;
    const isModel2 =
      !isModel3 &&
      (typeof modelJson?.model === 'string' ||
        typeof modelJson?.Model === 'string' ||
        Array.isArray(modelJson?.textures) ||
        Array.isArray(modelJson?.expressions) ||
        typeof modelJson?.motions === 'object');

    console.log(
      `[${SCRIPT_NAME}] Live2DUploader: 模型配置解析完成，目录: ${modelDir || '根目录'}，类型: ${
        isModel3 ? 'Cubism 3/4' : 'Cubism 2.1'
      }`,
    );

    let modelData;
    if (isModel3) {
      const moc3Data = await this._extractFile(zip, modelDir, modelJson.FileReferences?.Moc);
      const moc3HeaderVersion = this._readMoc3HeaderVersion(moc3Data);
      const detectedCubismVersion = await this._resolveModel3CubismVersion(modelJson, moc3Data);
      const detectedRuntimeType = resolveRuntimeTypeFromCubismVersion(detectedCubismVersion);
      const runtimeType = detectedRuntimeType;
      modelData = {
        modelId: characterId,
        cubismVersion: detectedCubismVersion,
        runtimeType,
        modelJson: modelJson,
        moc3: moc3Data,
        moc3Version: moc3HeaderVersion ?? null,
        moc: null,
        textures: await this._extractTextures(zip, modelDir, modelJson),
        motions: await this._extractMotions(zip, modelDir, modelJson),
        expressions: await this._extractExpressions(zip, modelDir, modelJson),
        physics: modelJson.FileReferences?.Physics
          ? await this._extractFileOptional(zip, modelDir, modelJson.FileReferences.Physics)
          : null,
        pose: modelJson.FileReferences?.Pose
          ? await this._extractFileOptional(zip, modelDir, modelJson.FileReferences.Pose)
          : null,
        uploadTime: Date.now(),
        fileSize: file.size,
      };
    } else if (isModel2) {
      const mocPath = modelJson?.model || modelJson?.Model;
      const physicsPath = modelJson?.physics || modelJson?.Physics;
      const posePath = modelJson?.pose || modelJson?.Pose;
      modelData = {
        modelId: characterId,
        cubismVersion: 2,
        runtimeType: LIVE2D_RUNTIME_TYPES.LEGACY,
        modelJson: modelJson,
        moc3: null,
        moc: await this._extractFile(zip, modelDir, mocPath),
        textures: await this._extractTexturesV2(zip, modelDir, modelJson),
        motions: await this._extractMotionsV2(zip, modelDir, modelJson),
        expressions: await this._extractExpressionsV2(zip, modelDir, modelJson),
        physics: physicsPath
          ? await this._extractFileOptional(zip, modelDir, physicsPath)
          : null,
        pose: posePath
          ? await this._extractFileOptional(zip, modelDir, posePath)
          : null,
        uploadTime: Date.now(),
        fileSize: file.size,
      };
    } else {
      throw new Error('未识别的 Live2D 模型格式：请确保 zip 中包含标准的 model3.json / model.json');
    }

    console.log(`[${SCRIPT_NAME}] Live2DUploader: runtime resolved for ${characterId}`, {
      runtimeType: modelData.runtimeType,
      cubismVersion: modelData.cubismVersion,
      mocBytes: modelData.moc3?.byteLength || modelData.moc?.byteLength || 0,
    });

    await saveLive2DModel(modelData);

    console.log(`[${SCRIPT_NAME}] Live2DUploader: 模型 ${characterId} 保存成功`);
    return modelData;
  },

  _toArrayBuffer(input) {
    if (!input) return null;
    if (input instanceof ArrayBuffer) return input;
    if (ArrayBuffer.isView(input)) {
      return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
    }
    return null;
  },

  _normalizeMocVersion(rawMocVersion) {
    const value = Number(rawMocVersion || 0);
    if (!Number.isFinite(value)) return null;
    if (value >= 5) return 5;
    if (value >= 1 && value <= 4) return 4;
    return null;
  },

  _readMoc3HeaderVersion(moc3Data) {
    const moc3Buffer = this._toArrayBuffer(moc3Data);
    if (!moc3Buffer || moc3Buffer.byteLength < 8) return null;

    try {
      const header = new Uint8Array(moc3Buffer, 0, 4);
      const signature = String.fromCharCode(...header);
      if (signature !== 'MOC3') return null;
      const view = new DataView(moc3Buffer);
      const versionLE = Number(view.getUint32(4, true) || 0) || null;
      return versionLE;
    } catch (e) {
      return null;
    }
  },

  _detectCubismVersionFromMoc3Buffer(moc3Data) {
    const moc3Buffer = this._toArrayBuffer(moc3Data);
    if (!moc3Buffer) return null;

    const _topWindow = typeof window.parent !== 'undefined' ? window.parent : window;
    const core = _topWindow?.Live2DCubismCore;
    const Moc = core?.Moc;
    const Version = core?.Version;
    if (typeof Moc?.fromArrayBuffer !== 'function' || typeof Version?.csmGetMocVersion !== 'function') {
      return null;
    }

    let mocRef = null;
    try {
      mocRef = Moc.fromArrayBuffer(moc3Buffer);
      if (!mocRef) return null;

      const rawMocVersion = Number(Version.csmGetMocVersion(mocRef, moc3Buffer) || 0) || 0;
      const latestMocVersion = Number(Version?.csmGetLatestMocVersion?.() || 0) || 0;
      const normalized = this._normalizeMocVersion(rawMocVersion);
      if (latestMocVersion > 0 && rawMocVersion > latestMocVersion) {
        return null;
      }
      return normalized;
    } catch (e) {
      return null;
    } finally {
      try {
        if (mocRef && typeof mocRef._release === 'function') mocRef._release();
        else if (mocRef && typeof mocRef.release === 'function') mocRef.release();
      } catch (e) {}
    }
  },

  async _resolveModel3CubismVersion(modelJson, moc3Data) {
    const jsonFallbackVersion = inferCubismVersionFromModelJson(modelJson, 4) || 4;
    const headerVersionRaw = this._readMoc3HeaderVersion(moc3Data);
    const headerVersion = this._normalizeMocVersion(headerVersionRaw);

    // MOC3 header is the most stable signal for runtime routing.
    // Use it directly when available to avoid probe timing/caching drift.
    if (headerVersion != null) {
      if (headerVersion !== jsonFallbackVersion) {
        console.log(
          `[${SCRIPT_NAME}] Live2DUploader: moc3 header version detected as ${headerVersion} (model.json inferred ${jsonFallbackVersion})`,
        );
      }
      return headerVersion;
    }

    try {
      const requiredLatestVersion = headerVersionRaw >= 5 ? headerVersionRaw : 5;
      await Live2DLoader.ensureCubism5Core(requiredLatestVersion);
    } catch (e) {}

    const mocVersion = this._detectCubismVersionFromMoc3Buffer(moc3Data);
    if (mocVersion != null && mocVersion !== jsonFallbackVersion) {
      console.log(
        `[${SCRIPT_NAME}] Live2DUploader: moc3 version detected as ${mocVersion} (model.json inferred ${jsonFallbackVersion})`,
      );
    }
    return mocVersion ?? headerVersion ?? jsonFallbackVersion;
  },

  async _findModelJson(zip) {
    const candidates = [];
    const jsonEntries = [];

    zip.forEach((path, file) => {
      if (file.dir) return;
      if (/(^|\/)model3\.json$/i.test(path) || /\.model3\.json$/i.test(path)) {
        candidates.push({ path, file, priority: 1 });
      } else if (/(^|\/)model\.json$/i.test(path) || /\.model\.json$/i.test(path)) {
        candidates.push({ path, file, priority: 2 });
      } else if (/(^|\/)model[_-]?\d+\.json$/i.test(path)) {
        candidates.push({ path, file, priority: 3 });
      }

      if (/\.json$/i.test(path)) {
        jsonEntries.push({ path, file });
      }
    });

    if (candidates.length > 0) {
      candidates.sort((a, b) => a.priority - b.priority);
      return candidates[0];
    }

    let best = null;
    let bestScore = 0;
    for (const entry of jsonEntries) {
      try {
        const text = await entry.file.async('text');
        const json = JSON.parse(text);
        if (!json || typeof json !== 'object') continue;

        let score = 0;
        const fileName = String(entry.path).split('/').pop().toLowerCase();
        if (fileName.includes('model')) score += 50;

        if (json.FileReferences && typeof json.FileReferences === 'object') {
          score += 100;
          if (typeof json.FileReferences.Moc === 'string') score += 1000;
          if (Array.isArray(json.FileReferences.Textures)) score += 200;
        }

        if (typeof json.model === 'string' || typeof json.Model === 'string') score += 900;
        if (Array.isArray(json.textures) || Array.isArray(json.Textures)) score += 200;

        if (score > bestScore) {
          best = entry;
          bestScore = score;
        }
      } catch (e) {}
    }

    return best;
  },

  async _extractFile(zip, baseDir, relativePath) {
    if (!relativePath) throw new Error('文件路径为空');

    const fullPath = baseDir + relativePath;
    let file = zip.file(fullPath);

    if (!file) {
      file = zip.file(relativePath);
    }

    if (!file) {
      const normalizedPath = relativePath.replace(/\\/g, '/');
      file = zip.file(baseDir + normalizedPath) || zip.file(normalizedPath);
    }

    if (!file) {
      throw new Error(`文件不存在: ${fullPath}`);
    }

    return await file.async('arraybuffer');
  },

  async _extractFileOptional(zip, baseDir, relativePath) {
    try {
      return await this._extractFile(zip, baseDir, relativePath);
    } catch {
      return null;
    }
  },

  async _extractTextures(zip, baseDir, modelJson) {
    const textures = [];
    const textureList = modelJson.FileReferences?.Textures || [];

    for (const texPath of textureList) {
      try {
        const data = await this._extractFile(zip, baseDir, texPath);
        const mimeType = texPath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        textures.push({
          name: texPath,
          data: new Blob([data], { type: mimeType }),
        });
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DUploader: 纹理提取失败: ${texPath}`, e);
      }
    }

    return textures;
  },

  async _extractTexturesV2(zip, baseDir, modelJson) {
    const textures = [];
    const textureList = modelJson?.textures || modelJson?.Textures || [];
    if (!Array.isArray(textureList)) return textures;

    for (const texPath of textureList) {
      if (!texPath) continue;
      try {
        const data = await this._extractFile(zip, baseDir, texPath);
        const lower = String(texPath).toLowerCase();
        const mimeType = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
        textures.push({
          name: texPath,
          data: new Blob([data], { type: mimeType }),
        });
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DUploader: 纹理提取失败: ${texPath}`, e);
      }
    }

    return textures;
  },

  async _extractMotions(zip, baseDir, modelJson) {
    const motions = {};
    const motionGroups = modelJson.FileReferences?.Motions || {};

    for (const [groupName, motionList] of Object.entries(motionGroups)) {
      motions[groupName] = [];
      if (!Array.isArray(motionList)) continue;

      for (const motionDef of motionList) {
        const filePath = typeof motionDef === 'string' ? motionDef : motionDef?.File;
        if (!filePath) continue;

        try {
          const data = await this._extractFile(zip, baseDir, filePath);
          motions[groupName].push({ name: filePath, data: data });
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Live2DUploader: 动作提取失败: ${filePath}`);
        }
      }
    }

    if (Object.keys(motions).length === 0) {
      const scannedMotions = [];
      zip.forEach((path, file) => {
        if (file.dir) return;
        if (path.startsWith(baseDir) && /\.motion3\.json$/i.test(path)) {
          const relativePath = path.substring(baseDir.length);
          scannedMotions.push(relativePath);
        }
      });

      if (scannedMotions.length > 0) {
        motions['default'] = [];
        for (const filePath of scannedMotions) {
          try {
            const data = await this._extractFile(zip, baseDir, filePath);
            motions['default'].push({ name: filePath, data: data });
          } catch (e) {
            console.warn(`[${SCRIPT_NAME}] Live2DUploader: 扫描动作提取失败: ${filePath}`);
          }
        }
        console.log(`[${SCRIPT_NAME}] Live2DUploader: 自动扫描到 ${scannedMotions.length} 个动作文件`);
      }
    }

    return motions;
  },

  async _extractMotionsV2(zip, baseDir, modelJson) {
    const motions = {};
    const motionGroups = modelJson?.motions || modelJson?.Motions || {};

    for (const [groupName, motionList] of Object.entries(motionGroups || {})) {
      motions[groupName] = [];
      if (!Array.isArray(motionList)) continue;

      for (const motionDef of motionList) {
        const filePath = typeof motionDef === 'string' ? motionDef : motionDef?.file || motionDef?.File;
        if (!filePath) continue;

        try {
          const data = await this._extractFile(zip, baseDir, filePath);
          motions[groupName].push({ name: filePath, data: data });
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Live2DUploader: 动作提取失败: ${filePath}`);
        }
      }
    }

    const extractedCount = Object.values(motions).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0);

    if (extractedCount === 0) {
      const scannedMotions = [];
      zip.forEach((path, file) => {
        if (file.dir) return;
        if (path.startsWith(baseDir) && /\.mtn$/i.test(path)) {
          const relativePath = path.substring(baseDir.length);
          scannedMotions.push(relativePath);
        }
      });

      if (scannedMotions.length > 0) {
        motions['default'] = [];
        for (const filePath of scannedMotions) {
          try {
            const data = await this._extractFile(zip, baseDir, filePath);
            motions['default'].push({ name: filePath, data: data });
          } catch (e) {
            console.warn(`[${SCRIPT_NAME}] Live2DUploader: 扫描动作提取失败: ${filePath}`);
          }
        }
        console.log(`[${SCRIPT_NAME}] Live2DUploader: 自动扫描到 ${scannedMotions.length} 个动作文件`);
      }
    }

    return motions;
  },

  async _extractExpressions(zip, baseDir, modelJson) {
    const expressions = [];
    const exprList = modelJson.FileReferences?.Expressions || [];

    for (const exprDef of exprList) {
      const filePath = typeof exprDef === 'string' ? exprDef : exprDef?.File;
      const name = typeof exprDef === 'object' ? exprDef?.Name : filePath;
      if (!filePath) continue;

      try {
        const data = await this._extractFile(zip, baseDir, filePath);
        expressions.push({ name: name || filePath, file: filePath, data: data });
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] Live2DUploader: 表情提取失败: ${filePath}`);
      }
    }

    if (expressions.length === 0) {
      const scannedExprs = [];
      zip.forEach((path, file) => {
        if (file.dir) return;
        if (path.startsWith(baseDir) && /\.exp3\.json$/i.test(path)) {
          const relativePath = path.substring(baseDir.length);
          scannedExprs.push(relativePath);
        }
      });

      for (const filePath of scannedExprs) {
        try {
          const data = await this._extractFile(zip, baseDir, filePath);
          const name = filePath.replace(/\.exp3\.json$/i, '').split('/').pop();
          expressions.push({ name: name, file: filePath, data: data });
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Live2DUploader: 扫描表情提取失败: ${filePath}`);
        }
      }

      if (scannedExprs.length > 0) {
        console.log(`[${SCRIPT_NAME}] Live2DUploader: 自动扫描到 ${scannedExprs.length} 个表情文件`);
      }
    }

    return expressions;
  },

  async _extractExpressionsV2(zip, baseDir, modelJson) {
    const expressions = [];
    const exprList = modelJson?.expressions || modelJson?.Expressions || [];

    if (Array.isArray(exprList)) {
      for (const exprDef of exprList) {
        const filePath = typeof exprDef === 'string' ? exprDef : exprDef?.file || exprDef?.File;
        const name = typeof exprDef === 'string' ? exprDef : exprDef?.name || exprDef?.Name || filePath;
        if (!filePath) continue;

        try {
          const data = await this._extractFile(zip, baseDir, filePath);
          expressions.push({ name: name || filePath, file: filePath, data: data });
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Live2DUploader: 表情提取失败: ${filePath}`);
        }
      }
    }

    if (expressions.length === 0) {
      const scannedExprs = [];
      zip.forEach((path, file) => {
        if (file.dir) return;
        if (path.startsWith(baseDir) && /\.exp\.json$/i.test(path)) {
          const relativePath = path.substring(baseDir.length);
          scannedExprs.push(relativePath);
        }
      });

      for (const filePath of scannedExprs) {
        try {
          const data = await this._extractFile(zip, baseDir, filePath);
          const name = filePath.replace(/\.exp\.json$/i, '').split('/').pop();
          expressions.push({ name: name, file: filePath, data: data });
        } catch (e) {
          console.warn(`[${SCRIPT_NAME}] Live2DUploader: 扫描表情提取失败: ${filePath}`);
        }
      }

      if (scannedExprs.length > 0) {
        console.log(`[${SCRIPT_NAME}] Live2DUploader: 自动扫描到 ${scannedExprs.length} 个表情文件`);
      }
    }

    return expressions;
  }
};
