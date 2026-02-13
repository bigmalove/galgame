import { SCRIPT_NAME, DEFAULT_PACK_ID } from '../core/constants.js';
import { $ } from '../core/env.js';
import { saveSprite, saveSpritesBatch, getAllSprites } from '../db/sprites.js';
import { saveBackground, saveBackgroundsBatch, getAllBackgrounds } from '../db/backgrounds.js';
import { getCurrentPackId, getAllImagePacks, createImagePack } from '../db/image-packs.js';
import { getAllExpressions, getCustomExpressions, saveCustomExpressions } from '../utils/expressions.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';
import { makeDraggable } from './interaction.js';

// ============================================
// 资源导入导出管理器 (Asset IO)
// ============================================

export async function importAssetsFromJson(file, targetPackId = null) {
  try {
    const text = await file.text();
    const json = JSON.parse(text);

    if (!targetPackId) {
      const suggestedName = json.packageName || json.name;
      targetPackId = await showImportPackSelector(suggestedName);
      if (!targetPackId) {
        showToast('已取消导入');
        return;
      }
    }

    let count = 0;
    const newExpressions = [];
    if (json.sprites) {
      const allExpressions = getAllExpressions();
      const customs = getCustomExpressions();
      for (const s of json.sprites) {
        if (s.characterId && s.expression && s.url) {
          await saveSprite(s.characterId, s.expression, null, s.url, targetPackId);
          count++;
          const expr = s.expression;
          if (!allExpressions.includes(expr) && !newExpressions.includes(expr) && !customs.find(e => e.name === expr)) {
            newExpressions.push(expr);
            customs.push({ name: expr, emotion: null });
          }
        }
      }
      if (newExpressions.length > 0) {
        saveCustomExpressions(customs);
        console.log(`[${SCRIPT_NAME}] 自动注册表情标签: ${newExpressions.join(', ')}`);
      }
    }
    if (json.backgrounds) {
      for (const bg of json.backgrounds) {
        if (bg.sceneName && bg.url) {
          await saveBackground(bg.sceneName, null, bg.url, targetPackId);
          count++;
        }
      }
    }
    showToast(`成功导入 ${count} 个远程资源链接`);
  } catch (e) {
    console.error('JSON导入失败', e);
    showToast('JSON导入失败: ' + e.message);
  }
}

export const AssetIO = {
  jszip: null,
  async loadJSZip() {
    if (this.jszip) return this.jszip;
    if (window.JSZip) {
      this.jszip = window.JSZip;
      return this.jszip;
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => {
        this.jszip = window.JSZip;
        console.log(`[${SCRIPT_NAME}] JSZip 加载成功`);
        resolve(this.jszip);
      };
      script.onerror = () => reject(new Error('JSZip load failed'));
      document.head.appendChild(script);
    });
  },
  async exportAllAssets(remoteBaseUrl = null, packageName = null) {
    try {
      showToast('正在准备导出...');
      const zip = new (await this.loadJSZip())();

      const currentPackId = getCurrentPackId();
      const allPacks = await getAllImagePacks();
      const currentPack = allPacks.find(p => p.id === currentPackId);
      const currentPackName = currentPack ? currentPack.name : '未命名包';

      const remoteConfig = {
        packageName: packageName || currentPackName,
        exportDate: new Date().toISOString(),
        packId: currentPackId,
        sprites: [],
        backgrounds: [],
      };
      const baseUrl = remoteBaseUrl ? (remoteBaseUrl.endsWith('/') ? remoteBaseUrl : remoteBaseUrl + '/') : '';
      const sprites = await getAllSprites(currentPackId);
      const spritesFolder = zip.folder('sprites');
      for (const s of sprites) {
        if (s.imageBlob) {
          const ext = s.imageBlob.type.split('/')[1] || 'png';
          const safeChar = s.characterId.replace(/[\\/:*?"<>|]/g, '');
          const safeExpr = s.expression.replace(/[\\/:*?"<>|]/g, '');
          const filename = `${safeChar}_${safeExpr}.${ext}`;
          spritesFolder.file(filename, s.imageBlob);
          if (remoteBaseUrl) {
            remoteConfig.sprites.push({
              characterId: s.characterId,
              expression: s.expression,
              url: `${baseUrl}sprites/${filename}`,
              packId: s.packId || DEFAULT_PACK_ID,
            });
          }
        }
      }
      const backgrounds = await getAllBackgrounds(currentPackId);
      const bgFolder = zip.folder('backgrounds');
      for (const bg of backgrounds) {
        if (bg.imageBlob) {
          const ext = bg.imageBlob.type.split('/')[1] || 'png';
          const safeScene = bg.sceneName.replace(/[\\/:*?"<>|]/g, '');
          const filename = `${safeScene}.${ext}`;
          bgFolder.file(filename, bg.imageBlob);
          if (remoteBaseUrl) {
            remoteConfig.backgrounds.push({
              sceneName: bg.sceneName,
              url: `${baseUrl}backgrounds/${filename}`,
              packId: bg.packId || DEFAULT_PACK_ID,
            });
          }
        }
      }
      const packageInfo = {
        packageName: packageName || currentPackName,
        exportDate: new Date().toISOString(),
        version: '1.0',
        packId: currentPackId,
      };
      zip.file('package_info.json', JSON.stringify(packageInfo, null, 2));
      if (remoteBaseUrl) {
        zip.file('remote_assets.json', JSON.stringify(remoteConfig, null, 2));
      }
      showToast('正在压缩打包...');
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      const safePackageName = (packageName || currentPackName).replace(/[\\/:*?"<>|]/g, '_');
      const date = new Date().toISOString().slice(0, 10);
      a.download = `${safePackageName}_${date}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`导出成功！共导出 ${sprites.length} 个立绘，${backgrounds.length} 个背景`);
    } catch (e) {
      console.error(`[${SCRIPT_NAME}] 导出失败:`, e);
      showToast('导出失败: ' + e.message);
    }
  },
  async importFiles(fileList, targetPackId = null) {
    if (!targetPackId) {
      targetPackId = await showImportPackSelector('文件夹导入');
      if (!targetPackId) {
        showToast('已取消导入');
        return false;
      }
    }

    let successCount = 0;
    let failCount = 0;
    showToast('开始导入...');
    for (const file of fileList) {
      try {
        const path = file.webkitRelativePath || file.name;
        const isSpriteFolder = path.includes('sprites/');
        const isBgFolder = path.includes('backgrounds/');
        let imported = false;
        if (isSpriteFolder) {
          await this.importAsSprite(file, targetPackId);
          imported = true;
        } else if (isBgFolder) {
          await this.importAsBackground(file, targetPackId);
          imported = true;
        } else if (file.name.includes('_')) {
          await this.importAsSprite(file, targetPackId);
          imported = true;
        } else {
          await this.importAsBackground(file, targetPackId);
          imported = true;
        }
        if (imported) successCount++;
      } catch (e) {
        console.warn(`[${SCRIPT_NAME}] 导入文件 ${file.name} 失败:`, e);
        failCount++;
      }
    }
    showToast(`导入完成: ${successCount} 成功, ${failCount} 失败`);
    return successCount > 0;
  },
  async importAsSprite(file, packId = null) {
    const fileName = file.name.split('/').pop();
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
    const parts = nameWithoutExt.split('_');
    if (parts.length >= 2) {
      const expression = parts.pop();
      const characterId = parts.join('_');
      if (characterId && expression) {
        await saveSprite(characterId, expression, file, null, packId);
        console.log(`[${SCRIPT_NAME}] 导入立绘: ${characterId} - ${expression}`);
        const allExpressions = getAllExpressions();
        if (!allExpressions.includes(expression)) {
          const customs = getCustomExpressions();
          if (!customs.find(e => e.name === expression)) {
            customs.push({ name: expression, emotion: null });
            saveCustomExpressions(customs);
            console.log(`[${SCRIPT_NAME}] 自动注册表情标签: ${expression}`);
          }
        }
        return;
      }
    }
    throw new Error('文件名格式不匹配 Name_Expression.ext');
  },
  async importAsBackground(file, packId = null) {
    const fileName = file.name.split('/').pop();
    const sceneName = fileName.substring(0, fileName.lastIndexOf('.'));
    if (sceneName) {
      await saveBackground(sceneName, file, null, packId);
      console.log(`[${SCRIPT_NAME}] 导入背景: ${sceneName}`);
    }
  },
  async importFromGitHub(repoUrl, targetPackId = null) {
    try {
      if (!targetPackId) {
        targetPackId = await showImportPackSelector(`GitHub导入`);
        if (!targetPackId) {
          showToast('已取消导入');
          return false;
        }
      }

      let owner, repo, path = '';
      let branch = 'main';
      if (repoUrl.startsWith('http')) {
        const urlObj = new URL(repoUrl);
        const parts = urlObj.pathname.split('/').filter(p => p);
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1];
          if (parts[2] === 'tree' || parts[2] === 'blob') {
            branch = parts[3];
            path = parts.slice(4).join('/');
          }
        }
      } else {
        const parts = repoUrl.split('/');
        if (parts.length >= 2) {
          owner = parts[0];
          repo = parts[1];
          if (parts.length > 2) path = parts.slice(2).join('/');
        }
      }
      if (!owner || !repo) {
        throw new Error('无效的 GitHub 仓库地址');
      }
      showToast(`正在获取文件列表: ${owner}/${repo}...`);
      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`GitHub API Error: ${response.statusText}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error('路径不是一个目录');
      const imageFiles = data.filter(item => item.type === 'file' && /\.(png|jpg|jpeg|gif|webp)$/i.test(item.name));
      if (imageFiles.length === 0) {
        showToast('该目录下没有找到图片文件');
        return;
      }
      if (!confirm(`找到 ${imageFiles.length} 张图片，是否开始导入？`)) return;
      let count = 0;
      for (const item of imageFiles) {
        showToast(`正在下载 (${count + 1}/${imageFiles.length}): ${item.name}`);
        try {
          const imgRes = await fetch(item.download_url);
          const blob = await imgRes.blob();
          const file = new File([blob], item.name, { type: blob.type });
          if (item.name.includes('_')) {
            await this.importAsSprite(file, targetPackId);
          } else {
            await this.importAsBackground(file, targetPackId);
          }
          count++;
        } catch (e) {
          console.error(`下载/导入 ${item.name} 失败:`, e);
        }
      }
      showToast(`GitHub 导入完成，共 ${count} 张图片`);
      return true;
    } catch (e) {
      console.error('GitHub Import Error:', e);
      showToast('GitHub 导入失败: ' + e.message);
      return false;
    }
  },
};

export function showRemoteZipImportDialog() {
  const dialogHtml = `
    <div class="gal-input-modal" id="gal-remote-zip-dialog">
      <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px;">
        <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-cloud-arrow-down"></i> 远程压缩包导入</span>
          <button id="gal-remote-zip-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="margin-bottom: 15px;">
          <label style="display: block; font-weight: 700; margin-bottom: 8px; color: #2b2e38;">
            <i class="fa-solid fa-link"></i> ZIP 文件链接
          </label>
          <input type="text" id="gal-remote-zip-url"
                 placeholder="https://example.com/assets.zip"
                 style="width: 100%; padding: 12px 15px; border: 2px solid #ddd; font-size: 1rem; box-sizing: border-box; border-radius: 6px;">
          <small style="color: #888; margin-top: 5px; display: block;">
            支持直接下载链接，如 GitHub Release、云盘直链等<br>
            <strong style="color: #e74c3c;">限制：最大 5GB</strong>
          </small>
        </div>
        <div class="gal-input-actions" style="display: flex; gap: 12px;">
          <button class="gal-action-btn primary" id="gal-remote-zip-confirm" style="flex: 1; min-height: 44px; justify-content: center;">
            <i class="fa-solid fa-download"></i>
            <span>下载并导入</span>
          </button>
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(dialogHtml);
  const $dialog = $(mountRoot).find('#gal-remote-zip-dialog');
  makeDraggable($dialog.find('.gal-input-box'), $dialog.find('.gal-input-title'));

  $dialog.find('#gal-remote-zip-close-x').on('click', () => $dialog.remove());
  $dialog.on('click', function (e) {
    if (e.target === this) $dialog.remove();
  });

  $dialog.find('#gal-remote-zip-confirm').on('click', async function () {
    const url = $dialog.find('#gal-remote-zip-url').val().trim();
    if (!url) {
      showToast('请输入ZIP文件链接');
      return;
    }
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      showToast('请输入有效的 HTTP/HTTPS 链接');
      return;
    }
    $dialog.remove();
    await importFromRemoteZip(url);
  });
}

export async function importFromZipFile(file) {
  let isCancelled = false;
  const progressController = showImportProgress('正在解压本地文件...', () => {
    isCancelled = true;
    showToast('导入已手动取消');
  });

  try {
    const JSZip = await AssetIO.loadJSZip();
    const zip = await JSZip.loadAsync(file, {
      onprogress: event => {
        if (isCancelled) return;
        const percent = Math.round(event.percent || 0);
        progressController.update(percent, `解压中... ${percent}%`);
      },
    });

    if (isCancelled) {
      progressController.close();
      return;
    }

    await processZipContents(zip, progressController, () => isCancelled);

    if (!isCancelled) {
      progressController.close();
      showToast('ZIP导入完成！');
    } else {
      progressController.close();
    }
  } catch (e) {
    progressController.close();
    if (isCancelled) return;
    console.error('ZIP导入失败:', e);
    showImportError(['ZIP文件解析失败', e.message || '未知错误', '请确保文件是有效的ZIP格式']);
  }
}

export async function importFromRemoteZip(url) {
  const abortController = new AbortController();
  let isCancelled = false;

  const progressController = showImportProgress('正在下载远程文件...', () => {
    isCancelled = true;
    abortController.abort();
    showToast('下载已取消');
  });

  try {
    const response = await fetch(url, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = response.headers.get('Content-Length');
    const MAX_SIZE = 5 * 1024 * 1024 * 1024;

    if (contentLength && parseInt(contentLength) > MAX_SIZE) {
      throw new Error(`文件大小 ${(parseInt(contentLength) / 1024 / 1024 / 1024).toFixed(2)} GB 超过 5GB 限制`);
    }

    const reader = response.body.getReader();
    const chunks = [];
    let receivedLength = 0;
    const totalLength = contentLength ? parseInt(contentLength) : 0;
    let lastProgressUpdate = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      chunks.push(value);
      receivedLength += value.length;

      if (receivedLength > MAX_SIZE) {
        throw new Error('下载的文件大小超过 5GB 限制');
      }

      const now = Date.now();
      if (totalLength > 0) {
        const percent = Math.round((receivedLength / totalLength) * 100);
        const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
        const total = (totalLength / 1024 / 1024).toFixed(1);
        if (now - lastProgressUpdate > 200 || percent === 100) {
          progressController.update(percent, `下载中: ${downloaded} MB / ${total} MB`);
          lastProgressUpdate = now;
        }
      } else {
        const downloaded = (receivedLength / 1024 / 1024).toFixed(1);
        if (now - lastProgressUpdate > 200) {
          progressController.update(-1, `下载中: ${downloaded} MB`);
          lastProgressUpdate = now;
        }
      }
    }

    if (isCancelled) {
      progressController.close();
      return;
    }

    const blob = new Blob(chunks);
    progressController.update(100, '下载完成，开始解压...');

    const JSZip = await AssetIO.loadJSZip();
    const zip = await JSZip.loadAsync(blob);

    await processZipContents(zip, progressController, () => isCancelled);

    if (!isCancelled) {
      progressController.close();
      showToast('远程ZIP导入完成！');
    } else {
      progressController.close();
    }
  } catch (e) {
    progressController.close();
    if (e.name === 'AbortError' || isCancelled) return;
    console.error('远程ZIP导入失败:', e);
    showImportError(['远程ZIP下载/导入失败', e.message || '网络错误', '请检查链接是否有效、是否支持跨域']);
  }
}

export async function showImportPackSelector(suggestedName = null) {
  return new Promise((resolve) => {
    getAllImagePacks().then(packs => {
      const currentPackId = getCurrentPackId();
      const currentPack = packs.find(p => p.id === currentPackId);
      const currentPackName = currentPack ? currentPack.name : '当前图包';

      const packOptions = packs.map(p =>
        `<option value="${p.id}">${p.name}${p.id === currentPackId ? ' (当前)' : ''}</option>`
      ).join('');

      const defaultNewName = suggestedName || `导入包_${new Date().toISOString().slice(0, 10)}`;

      const dialogHtml = `
        <div class="gal-input-modal gal-z-critical" id="gal-import-pack-selector">
          <div class="gal-input-box" style="max-width: 450px; width: 90%; padding: 25px;">
            <div class="gal-input-title" style="margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between;">
              <span><i class="fa-solid fa-box-open"></i> 选择导入目标图包</span>
              <button id="gal-import-pack-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            <div style="margin-bottom: 20px;">
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #3498db; border-radius: 6px; background: #f8f9fa;">
                <input type="radio" name="import-target" value="current" checked style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">导入到当前图包</span>
                <span style="color: #666; font-size: 0.85rem; margin-left: auto;">${currentPackName}</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #ddd; border-radius: 6px;">
                <input type="radio" name="import-target" value="existing" style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">导入到已有图包</span>
              </label>
              <select id="gal-import-existing-pack" disabled style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; margin-bottom: 15px; margin-left: 26px; opacity: 0.6;">
                ${packOptions}
              </select>
              <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px; cursor: pointer; padding: 10px; border: 2px solid #ddd; border-radius: 6px;">
                <input type="radio" name="import-target" value="new" style="width: 18px; height: 18px;">
                <span style="font-weight: 600; color: #2b2e38;">创建新图包</span>
              </label>
              <input type="text" id="gal-import-new-pack-name" disabled placeholder="输入新图包名称" value="${defaultNewName}"
                     style="width: 100%; padding: 10px; border: 2px solid #ddd; border-radius: 4px; margin-left: 26px; opacity: 0.6; box-sizing: border-box;">
            </div>
            <div class="gal-input-actions" style="display: flex; gap: 12px;">
              <button class="gal-action-btn" id="gal-import-pack-confirm" style="flex: 1; min-height: 44px; justify-content: center; background: #28a745; color: #fff; border-color: #28a745;">
                <i class="fa-solid fa-check"></i> <span>确认导入</span>
              </button>
            </div>
          </div>
        </div>
      `;

      const mountRoot = getModalMountRoot();
      $(mountRoot).append(dialogHtml);
      const $dialog = $(mountRoot).find('#gal-import-pack-selector');

      $dialog.find('input[name="import-target"]').on('change', function() {
        const value = $(this).val();
        const $existingSelect = $dialog.find('#gal-import-existing-pack');
        const $newInput = $dialog.find('#gal-import-new-pack-name');
        $existingSelect.prop('disabled', value !== 'existing').css('opacity', value === 'existing' ? 1 : 0.6);
        $newInput.prop('disabled', value !== 'new').css('opacity', value === 'new' ? 1 : 0.6);
        $dialog.find('label').css('border-color', '#ddd');
        $(this).closest('label').css('border-color', '#3498db');
      });

      $dialog.find('#gal-import-pack-confirm').on('click', () => {
        const targetType = $dialog.find('input[name="import-target"]:checked').val();
        let resultPackId = null;

        if (targetType === 'current') {
          resultPackId = currentPackId;
        } else if (targetType === 'existing') {
          resultPackId = $dialog.find('#gal-import-existing-pack').val();
        } else if (targetType === 'new') {
          const newName = $dialog.find('#gal-import-new-pack-name').val().trim();
          if (!newName) {
            showToast('请输入新图包名称');
            return;
          }
          createImagePack(newName).then(newPack => {
            $dialog.remove();
            resolve(newPack.id);
          }).catch(err => {
            showToast('创建图包失败: ' + err.message);
          });
          return;
        }

        $dialog.remove();
        resolve(resultPackId);
      });

      $dialog.find('#gal-import-pack-close-x').on('click', () => {
        $dialog.remove();
        resolve(null);
      });

      $dialog.on('click', function(e) {
        if (e.target === this) {
          $dialog.remove();
          resolve(null);
        }
      });
    }).catch(err => {
      console.error('获取图包列表失败:', err);
      showToast('获取图包列表失败');
      resolve(null);
    });
  });
}

export async function processZipContents(zip, progressController, isCancelledCheck, targetPackId = null) {
  const hasSpritesDir = Object.keys(zip.files).some(path => path.startsWith('sprites/'));
  const hasBackgroundsDir = Object.keys(zip.files).some(path => path.startsWith('backgrounds/'));

  if (!hasSpritesDir && !hasBackgroundsDir) {
    throw new Error('ZIP包格式错误：必须包含 sprites/ 或 backgrounds/ 目录');
  }

  let packageInfo = null;
  const infoFile = zip.file('package_info.json');
  if (infoFile) {
    try {
      const infoText = await infoFile.async('text');
      packageInfo = JSON.parse(infoText);
      console.log(`[${SCRIPT_NAME}] 读取到包信息:`, packageInfo);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] 读取 package_info.json 失败:`, e);
    }
  }

  if (!targetPackId) {
    const suggestedName = packageInfo?.packageName || packageInfo?.name;
    targetPackId = await showImportPackSelector(suggestedName);
    if (!targetPackId) {
      showToast('已取消导入');
      return;
    }
  }

  const imageFiles = [];
  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.dir) return;
    const isSprite = relativePath.startsWith('sprites/');
    const isBackground = relativePath.startsWith('backgrounds/');
    if (!isSprite && !isBackground) return;
    const ext = relativePath.split('.').pop().toLowerCase();
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'].includes(ext)) return;
    imageFiles.push({
      path: relativePath,
      entry: zipEntry,
      type: isSprite ? 'sprite' : 'background',
    });
  });

  if (imageFiles.length === 0) {
    throw new Error('ZIP包中未找到有效的图片文件');
  }

  progressController.update(0, `准备导入 ${imageFiles.length} 个文件...`);

  const BATCH_SIZE = 50;
  let successCount = 0;
  let failedItems = [];

  for (let i = 0; i < imageFiles.length; i += BATCH_SIZE) {
    if (isCancelledCheck && isCancelledCheck()) {
      console.log(`[${SCRIPT_NAME}] 导入已取消`);
      return;
    }

    const batch = imageFiles.slice(i, i + BATCH_SIZE);
    const spriteBatch = [];
    const backgroundBatch = [];

    await Promise.all(
      batch.map(async (item) => {
        try {
          const blob = await item.entry.async('blob');
          const fileName = item.path.split('/').pop();

          if (item.type === 'sprite') {
            const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            const parts = nameWithoutExt.split('_');
            if (parts.length >= 2) {
              const expression = parts.pop();
              const characterId = parts.join('_');
              spriteBatch.push({ characterId, expression, imageBlob: blob });
            }
          } else if (item.type === 'background') {
            const sceneName = fileName.substring(0, fileName.lastIndexOf('.'));
            backgroundBatch.push({ sceneName, imageBlob: blob });
          }
        } catch (e) {
          console.warn(`解压 ${item.path} 失败:`, e);
          failedItems.push({ path: item.path, error: e.message });
        }
      }),
    );

    if (spriteBatch.length > 0) {
      await saveSpritesBatch(spriteBatch, targetPackId);
      const allExpressions = getAllExpressions();
      const customs = getCustomExpressions();
      const newExpressions = [];
      for (const sprite of spriteBatch) {
        const expr = sprite.expression;
        if (!allExpressions.includes(expr) && !newExpressions.includes(expr) && !customs.find(e => e.name === expr)) {
          newExpressions.push(expr);
          customs.push({ name: expr, emotion: null });
        }
      }
      if (newExpressions.length > 0) {
        saveCustomExpressions(customs);
        console.log(`[${SCRIPT_NAME}] 自动注册表情标签: ${newExpressions.join(', ')}`);
      }
    }
    if (backgroundBatch.length > 0) {
      await saveBackgroundsBatch(backgroundBatch, targetPackId);
    }

    successCount += spriteBatch.length + backgroundBatch.length;

    const processed = Math.min(i + BATCH_SIZE, imageFiles.length);
    const percent = Math.round((processed / imageFiles.length) * 100);
    progressController.update(percent, `导入中: ${processed}/${imageFiles.length} (批量模式)`);
  }

  if (failedItems.length > 0) {
    showImportError([
      `成功: ${successCount} 个, 失败: ${failedItems.length} 个`,
      '部分文件导入失败，请检查详情...',
    ]);
  }

  console.log(`[${SCRIPT_NAME}] ZIP导入完成: 成功 ${successCount}, 失败 ${failedItems.length}`);
}

export function showImportProgress(initialText, onCancel) {
  $('.gal-import-progress-overlay').remove();

  const html = `
    <div class="gal-import-progress-overlay">
      <div class="gal-import-progress-box">
        <div class="gal-import-progress-title">
          <i class="fa-solid fa-spinner fa-spin"></i> 正在导入资源
        </div>
        <div class="gal-import-progress-bar-container">
          <div class="gal-import-progress-bar"></div>
        </div>
        <div class="gal-import-progress-text">${initialText}</div>
        <div class="gal-import-progress-details"></div>
        <button class="gal-action-btn" id="gal-import-cancel-btn" style="margin-top: 15px; background: #e74c3c; color: #fff; border: none; padding: 6px 15px; font-size: 0.9rem;">
          <i class="fa-solid fa-xmark"></i> 取消
        </button>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(html);
  const $overlay = $(mountRoot).find('.gal-import-progress-overlay');

  if (onCancel) {
    $overlay.find('#gal-import-cancel-btn').on('click', onCancel);
  } else {
    $overlay.find('#gal-import-cancel-btn').hide();
  }

  return {
    update: (percent, text) => {
      if (percent >= 0) {
        $overlay.find('.gal-import-progress-bar').css('width', percent + '%');
      } else {
        $overlay.find('.gal-import-progress-bar').css('width', '30%');
      }
      $overlay.find('.gal-import-progress-text').text(text);
    },
    close: () => {
      $overlay.fadeOut(300, function () {
        $(this).remove();
      });
    },
  };
}

export function showImportError(messages) {
  $('#gal-import-error-dialog').remove();

  const errorHtml = `
    <div class="gal-input-modal" id="gal-import-error-dialog">
      <div class="gal-input-box" style="max-width: 500px; width: 90%; padding: 25px; border-color: #e74c3c;">
        <div class="gal-input-title" style="margin-bottom: 20px; color: #e74c3c; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-circle-exclamation"></i> 导入出错</span>
          <button id="gal-import-error-close-x" title="关闭" style="background: none; border: none; cursor: pointer; font-size: 1.2rem; color: #999; padding: 4px 8px; line-height: 1; transition: color 0.2s; transform: none;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="background: #fdf2f2; border: 1px solid #f5c6cb; border-radius: 6px; padding: 15px; margin-bottom: 20px; max-height: 300px; overflow-y: auto;">
          ${messages.map(msg => `<div style="margin-bottom: 5px; color: #721c24; font-size: 0.9rem; white-space: pre-wrap;">${msg}</div>`).join('')}
        </div>
      </div>
    </div>
  `;

  const mountRoot = getModalMountRoot();
  $(mountRoot).append(errorHtml);
  const $dialog = $(mountRoot).find('#gal-import-error-dialog');

  $dialog.find('#gal-import-error-close-x').on('click', () => $dialog.remove());
  $dialog.on('click', function (e) {
    if (e.target === this) $dialog.remove();
  });
}
