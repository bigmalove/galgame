import {
  buildGptSoVitsModelId,
  buildRuntimeVoiceFromGptSoVitsModel,
  getGptSoVitsConfig,
  inferGptSoVitsModelsFromFolderFiles,
  normalizeGptSoVitsModelForStore,
  normalizeGptSoVitsModelsForStore,
  normalizeGptSoVitsSwitchMode,
  normalizeSetModelEndpoint,
} from '../audio/tts-config.js';
import { TTSManager } from '../audio/tts-manager.js';
import { SCRIPT_NAME, THEME } from '../core/constants.js';
import { $ } from '../core/env.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { getModalMountRoot } from './fullscreen.js';
import { showToast } from './toast.js';

function _safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function _safeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function _toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function _escapeHtmlLite(text) {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _normalizePathSep(path) {
  let s = String(path || '');
  if (!s) return '';
  s = s.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  try {
    s = s.normalize('NFC');
  } catch (e) {}
  return s.replace(/\\+/g, '/');
}

function _normalizeImportRootPath(path) {
  let s = _normalizePathSep(path).replace(/[\\/]+$/g, '');
  if (/^[a-zA-Z]:$/.test(s)) s = `${s}/`;
  return s;
}

function _normalizeModelMatchKey(value) {
  let s = String(value || '').trim();
  if (!s) return '';
  try {
    s = s.normalize('NFKC');
  } catch (e) {}
  return s.toLowerCase();
}

function _pickDefaultRef(model) {
  const refs = _safeArray(model?.refAudios);
  const path = String(model?.paths?.defaultRefAudioPath || '').trim();
  const id = String(model?.defaultRefId || '').trim();
  return refs.find(item => item.path === path) || refs.find(item => item.id === id) || refs[0] || null;
}

function _clearLegacyImportPathSettings() {
  const settings = getSettings();
  settings.gptSoVits = settings.gptSoVits || {};
  let changed = false;
  if (String(settings.gptSoVits.rootDir || '').trim()) {
    settings.gptSoVits.rootDir = '';
    changed = true;
  }
  if (String(settings.gptSoVits.importPathPrefix || '').trim()) {
    settings.gptSoVits.importPathPrefix = '';
    changed = true;
  }
  if (changed) saveSettings();
}

function _modelToLegacyVoice(model) {
  if (!model) return null;
  const defRef = _pickDefaultRef(model);
  const params = _safeObject(model.params);
  return {
    name: String(model.name || '').trim(),
    desc: String(model.desc || '').trim(),
    refAudioPath: String(defRef?.path || model?.paths?.defaultRefAudioPath || '').trim(),
    promptText: String(defRef?.promptText || params.promptText || '').trim(),
    promptLang: String(defRef?.promptLang || params.promptLang || 'zh').trim() || 'zh',
    textLang: String(defRef?.textLang || params.textLang || 'auto').trim() || 'auto',
    gptWeightsPath: String(model?.paths?.gptWeightsPath || '').trim(),
    sovitsWeightsPath: String(model?.paths?.sovitsWeightsPath || '').trim(),
  };
}

function _saveModelsToSettings(models) {
  const settings = getSettings();
  settings.gptSoVits = settings.gptSoVits || {};
  const cfg = getGptSoVitsConfig();
  const normalized = normalizeGptSoVitsModelsForStore(models, cfg);
  settings.gptSoVits.models = normalized;
  settings.gptSoVits.voices = normalized.map(_modelToLegacyVoice).filter(Boolean);
  saveSettings();
  return normalized;
}

function _getModelsFromSettings() {
  const cfg = getGptSoVitsConfig();
  return normalizeGptSoVitsModelsForStore(cfg.models, cfg);
}

function _buildDefaultModel() {
  const cfg = getGptSoVitsConfig();
  return normalizeGptSoVitsModelForStore(
    {
      id: buildGptSoVitsModelId('model'),
      name: '新模型',
      enabled: true,
      desc: '',
      paths: { gptWeightsPath: '', sovitsWeightsPath: '', defaultRefAudioPath: '' },
      params: {
        promptText: '',
        promptLang: 'zh',
        textLang: cfg.textLang || 'auto',
        textSplitMethod: cfg.textSplitMethod || 'cut5',
        speedFactor: _toFiniteNumber(cfg.speedFactor, 1),
        mediaType: cfg.mediaType || 'wav',
        streamingMode: !!cfg.streamingMode,
        modelSwitchMode: normalizeGptSoVitsSwitchMode(cfg.modelSwitchMode || 'set_weights'),
        setModelEndpoint: normalizeSetModelEndpoint(cfg.setModelEndpoint || '/set_model'),
        strictWeightSwitch: !!cfg.strictWeightSwitch,
      },
      refAudios: [],
      defaultRefId: '',
      expressionRefMap: {},
    },
    cfg,
  ) || null;
}

async function _previewModel(model, sampleText = '') {
  const cfg = getGptSoVitsConfig();
  const normalized = normalizeGptSoVitsModelForStore(model, cfg);
  if (!normalized) {
    showToast('试听失败：模型配置无效');
    return false;
  }
  const runtimeVoice = buildRuntimeVoiceFromGptSoVitsModel(normalized, cfg);
  if (!runtimeVoice) {
    showToast('试听失败：请先配置参考音频');
    return false;
  }
  if (!String(cfg.apiUrl || '').trim()) {
    showToast('试听失败：请先填写 GPT-SoVITS API 地址');
    return false;
  }

  const segment = {
    type: 'dialogue',
    speaker: '',
    text: String(sampleText || normalized?.params?.promptText || '').trim() || '你好，这是模型试听。',
    expression: '默认',
    tts: { emotion: '默认' },
  };

  try {
    TTSManager.stop();
    const playbackSessionId = Number(TTSManager._activePlaybackSessionId || 0) + 1;
    TTSManager._activePlaybackSessionId = playbackSessionId;
    TTSManager._abortGptSoVitsFetch('model-preview');
    const ok = await TTSManager._speakWithGptSoVits(segment, `model_preview_${Date.now()}`, runtimeVoice, playbackSessionId);
    if (!ok) showToast('试听失败：请检查 API、模型路径和参考音频');
    return !!ok;
  } catch (e) {
    const msg = String(e?.message || e || '').trim();
    showToast(`试听失败：${msg || 'unknown error'}`);
    return false;
  }
}

async function _openModelEditor(modelInput, onSave) {
  const cfg = getGptSoVitsConfig();
  const working = normalizeGptSoVitsModelForStore(modelInput || _buildDefaultModel(), cfg) || _buildDefaultModel();
  if (!working) {
    showToast('模型初始化失败');
    return;
  }
  const refsText = JSON.stringify(_safeArray(working.refAudios), null, 2);
  const mapText = JSON.stringify(_safeObject(working.expressionRefMap), null, 2);
  const current = Object.assign({}, working, {
    refAudiosJson: refsText,
    expressionRefMapJson: mapText,
  });

  const modalHtml = `
    <div class="gal-input-modal" id="gal-gpt-model-editor-modal">
      <div class="gal-input-box" style="width:min(1100px,95vw);max-width:none !important;max-height:90vh;overflow:auto;">
        <h3 style="margin:0 0 12px 0;color:${THEME.dark};">GPT-SoVITS 模型编辑</h3>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(260px,1fr));gap:10px;">
          <label>模型名<input id="gal-gpt-edit-name" value="${_escapeHtmlLite(current.name || '')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
          <label>备注<input id="gal-gpt-edit-desc" value="${_escapeHtmlLite(current.desc || '')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
          <label>gpt权重<input id="gal-gpt-edit-gpt" value="${_escapeHtmlLite(current.paths?.gptWeightsPath || '')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
          <label>sovits权重<input id="gal-gpt-edit-sovits" value="${_escapeHtmlLite(current.paths?.sovitsWeightsPath || '')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
          <label>默认参考音频<input id="gal-gpt-edit-ref" value="${_escapeHtmlLite(current.paths?.defaultRefAudioPath || '')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
          <label>prompt_text<input id="gal-gpt-edit-prompt" value="${_escapeHtmlLite(current.params?.promptText || '')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
          <label>prompt_lang<input id="gal-gpt-edit-plang" value="${_escapeHtmlLite(current.params?.promptLang || 'zh')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
          <label>text_lang<input id="gal-gpt-edit-tlang" value="${_escapeHtmlLite(current.params?.textLang || 'auto')}" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;"></label>
        </div>
        <div style="margin-top:10px;">
          <label>参考音频列表 JSON<textarea id="gal-gpt-edit-refs" rows="8" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-family:ui-monospace,Consolas,monospace;">${_escapeHtmlLite(current.refAudiosJson)}</textarea></label>
        </div>
        <div style="margin-top:10px;">
          <label>表情映射 JSON<textarea id="gal-gpt-edit-map" rows="6" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:6px;font-family:ui-monospace,Consolas,monospace;">${_escapeHtmlLite(current.expressionRefMapJson)}</textarea></label>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px;">
          <button class="gal-action-btn" id="gal-gpt-edit-preview"><i class="fa-solid fa-play"></i> 试听</button>
          <button class="gal-action-btn" id="gal-gpt-edit-cancel">取消</button>
          <button class="gal-action-btn primary" id="gal-gpt-edit-save"><i class="fa-solid fa-save"></i> 保存</button>
        </div>
      </div>
    </div>
  `;
  const mountRoot = getModalMountRoot();
  $(mountRoot).find('#gal-gpt-model-editor-modal').remove();
  $(mountRoot).append(modalHtml);
  const $modal = $(mountRoot).find('#gal-gpt-model-editor-modal');
  const close = () => $modal.remove();
  $modal.on('click', e => { if (e.target === $modal[0]) close(); });
  $modal.find('#gal-gpt-edit-cancel').on('click', close);
  $modal.find('#gal-gpt-edit-preview').on('click', async () => {
    let refs = [];
    try {
      refs = JSON.parse($modal.find('#gal-gpt-edit-refs').val() || '[]');
    } catch (e) {
      showToast('参考音频 JSON 无法解析');
      return;
    }
    const draft = {
      id: working.id || buildGptSoVitsModelId('model'),
      name: String($modal.find('#gal-gpt-edit-name').val() || '').trim(),
      desc: String($modal.find('#gal-gpt-edit-desc').val() || '').trim(),
      enabled: true,
      paths: {
        gptWeightsPath: String($modal.find('#gal-gpt-edit-gpt').val() || '').trim(),
        sovitsWeightsPath: String($modal.find('#gal-gpt-edit-sovits').val() || '').trim(),
        defaultRefAudioPath: String($modal.find('#gal-gpt-edit-ref').val() || '').trim(),
      },
      params: {
        promptText: String($modal.find('#gal-gpt-edit-prompt').val() || '').trim(),
        promptLang: String($modal.find('#gal-gpt-edit-plang').val() || 'zh').trim() || 'zh',
        textLang: String($modal.find('#gal-gpt-edit-tlang').val() || 'auto').trim() || 'auto',
      },
      refAudios: _safeArray(refs),
      expressionRefMap: {},
      defaultRefId: '',
    };
    await _previewModel(draft);
  });
  $modal.find('#gal-gpt-edit-save').on('click', async () => {
    let refs = [];
    let exprMap = {};
    try {
      refs = JSON.parse($modal.find('#gal-gpt-edit-refs').val() || '[]');
    } catch (e) {
      showToast('参考音频 JSON 无法解析');
      return;
    }
    try {
      exprMap = JSON.parse($modal.find('#gal-gpt-edit-map').val() || '{}');
    } catch (e) {
      showToast('表情映射 JSON 无法解析');
      return;
    }
    const draft = {
      id: working.id || buildGptSoVitsModelId('model'),
      name: String($modal.find('#gal-gpt-edit-name').val() || '').trim(),
      desc: String($modal.find('#gal-gpt-edit-desc').val() || '').trim(),
      enabled: true,
      paths: {
        gptWeightsPath: String($modal.find('#gal-gpt-edit-gpt').val() || '').trim(),
        sovitsWeightsPath: String($modal.find('#gal-gpt-edit-sovits').val() || '').trim(),
        defaultRefAudioPath: String($modal.find('#gal-gpt-edit-ref').val() || '').trim(),
      },
      params: {
        promptText: String($modal.find('#gal-gpt-edit-prompt').val() || '').trim(),
        promptLang: String($modal.find('#gal-gpt-edit-plang').val() || 'zh').trim() || 'zh',
        textLang: String($modal.find('#gal-gpt-edit-tlang').val() || 'auto').trim() || 'auto',
      },
      refAudios: _safeArray(refs),
      expressionRefMap: _safeObject(exprMap),
      defaultRefId: '',
    };
    const normalized = normalizeGptSoVitsModelForStore(draft, cfg);
    if (!normalized || !String(normalized.name || '').trim()) {
      showToast('模型保存失败：模型名不能为空');
      return;
    }
    if (typeof onSave === 'function') await onSave(normalized);
    close();
  });
}

export function openGptSoVitsModelManager(options = {}) {
  const onChanged = typeof options.onChanged === 'function' ? options.onChanged : null;
  const mountRoot = getModalMountRoot();
  $(mountRoot).find('#gal-gpt-model-manager-modal').remove();
  _clearLegacyImportPathSettings();
  $(mountRoot).append(`
    <div class="gal-input-modal" id="gal-gpt-model-manager-modal">
      <div class="gal-input-box" style="width:min(1500px,96vw);max-width:none !important;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;padding:0;">
        <div style="padding:12px 14px;border-bottom:1px solid #ddd;background:linear-gradient(135deg, ${THEME.accent} 0%, #00a8cc 100%);color:#fff;display:flex;justify-content:space-between;align-items:center;">
          <div style="font-weight:700;">GPT-SoVITS 模型管理</div>
          <button class="gal-action-btn" id="gal-gpt-model-manager-close" style="padding:6px 10px;background:rgba(255,255,255,0.2);"><i class="fa-solid fa-times"></i></button>
        </div>
        <div style="padding:10px;border-bottom:1px solid #e5e7eb;display:flex;gap:8px;flex-wrap:wrap;background:#f8fafc;">
          <button class="gal-action-btn primary" id="gal-gpt-model-add"><i class="fa-solid fa-plus"></i> 新增模型</button>
          <button class="gal-action-btn" id="gal-gpt-model-import-folder"><i class="fa-solid fa-folder-open"></i> 文件夹导入</button>
          <input type="file" id="gal-gpt-model-import-folder-file" webkitdirectory directory multiple style="display:none;">
          <input type="text" id="gal-gpt-model-search" placeholder="搜索模型名..." style="flex:1;min-width:260px;border:1px solid #d1d5db;border-radius:8px;padding:8px 10px;">
        </div>
        <div id="gal-gpt-model-list" style="padding:12px;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px;background:var(--SmartThemeFormBg,#fff);"></div>
      </div>
    </div>
  `);
  const $modal = $(mountRoot).find('#gal-gpt-model-manager-modal');
  let models = _getModelsFromSettings();

  const close = () => $modal.remove();
  $modal.on('click', e => { if (e.target === $modal[0]) close(); });
  $modal.find('#gal-gpt-model-manager-close').on('click', close);

  const saveModels = async next => {
    models = _saveModelsToSettings(next);
    if (typeof onChanged === 'function') await onChanged(models);
    renderList();
  };

  const getLegacyImportPrefix = () => {
    const settings = getSettings();
    return String(settings.gptSoVits?.importPathPrefix || settings.gptSoVits?.rootDir || '').trim();
  };

  const renderList = () => {
    const keyword = String($modal.find('#gal-gpt-model-search').val() || '').trim().toLowerCase();
    const filtered = models.filter(model => String(model.name || '').toLowerCase().includes(keyword));
    const $list = $modal.find('#gal-gpt-model-list');
    $list.empty();
    if (!filtered.length) {
      $list.html('<div style="color:#94a3b8;">暂无模型，可点击「新增模型」或「文件夹导入」。</div>');
      return;
    }
    filtered.forEach(model => {
      const refCount = _safeArray(model.refAudios).length;
      const gptPath = String(model?.paths?.gptWeightsPath || '').trim();
      const sovitsPath = String(model?.paths?.sovitsWeightsPath || '').trim();
      const activeRef = _pickDefaultRef(model);
      const refPath = String(activeRef?.path || model?.paths?.defaultRefAudioPath || '').trim();
      $list.append(`
        <div style="border:1px solid #e2e8f0;border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px;background:linear-gradient(180deg,#fff,#f8fbff);" data-model-id="${_escapeHtmlLite(model.id)}">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;">
            <div style="font-weight:700;color:#0f172a;">${_escapeHtmlLite(model.name)}</div>
            <span style="font-size:0.75rem;padding:2px 8px;border-radius:999px;background:${model.enabled !== false ? '#dcfce7' : '#fee2e2'};color:${model.enabled !== false ? '#166534' : '#991b1b'};">${model.enabled !== false ? '已启用' : '已停用'}</span>
          </div>
          <div style="font-size:0.78rem;color:#475569;">${_escapeHtmlLite(model.desc || '无备注')}</div>
          <div style="font-size:0.78rem;color:#64748b;">参考音频 ${refCount} 条</div>
          <div style="font-size:0.78rem;color:#64748b;">CKPT: ${_escapeHtmlLite(gptPath || '(未设置)')}</div>
          <div style="font-size:0.78rem;color:#64748b;">PTH: ${_escapeHtmlLite(sovitsPath || '(未设置)')}</div>
          <div style="font-size:0.78rem;color:#64748b;">默认参考: ${_escapeHtmlLite(refPath || '(未设置)')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="gal-action-btn primary" data-action="edit"><i class="fa-solid fa-pen"></i> 编辑</button>
            <button class="gal-action-btn" data-action="preview"><i class="fa-solid fa-play"></i> 试听</button>
            <button class="gal-action-btn" data-action="copy"><i class="fa-solid fa-copy"></i> 复制</button>
            <button class="gal-action-btn" data-action="set-default"><i class="fa-solid fa-star"></i> 设为默认</button>
            <button class="gal-action-btn" data-action="delete"><i class="fa-solid fa-trash"></i> 删除</button>
          </div>
        </div>
      `);
    });
  };

  $modal.find('#gal-gpt-model-search').on('input', renderList);
  $modal.find('#gal-gpt-model-add').on('click', () => {
    _openModelEditor(_buildDefaultModel(), async model => {
      await saveModels(models.concat([model]));
      showToast(`已新增模型：${model.name}`);
    });
  });
  $modal.find('#gal-gpt-model-import-folder').on('click', () => {
    $modal.find('#gal-gpt-model-import-folder-file').trigger('click');
  });
  $modal.find('#gal-gpt-model-import-folder-file').on('change', async function () {
    try {
      const list = this.files;
      if (!list || list.length === 0) return;
      const files = Array.from(list);
      const legacyPrefix = _normalizePathSep(getLegacyImportPrefix());
      const manualPrefix = window.prompt(
        '请输入导入根路径（绝对路径）。\n例如你选的是 I:/Downloads/GPT-SoVITS v2 pro plus/MyGO!!!!!/高松灯\n可填写 I:/Downloads/GPT-SoVITS v2 pro plus/MyGO!!!!!\n也可填写 I:/Downloads/GPT-SoVITS v2 pro plus/MyGO!!!!!/高松灯（末尾有无 / 或 \\ 都可）',
        legacyPrefix || '',
      );
      const importPrefix = _normalizeImportRootPath(String(manualPrefix || '').trim());
      if (!importPrefix) {
        showToast('已取消导入：未填写导入根路径。');
        return;
      }
      showToast(`本次导入路径：${importPrefix}`);
      let rootName = '';
      for (const file of files) {
        const rel = String(file?.webkitRelativePath || '').trim().replace(/\\/g, '/');
        const first = String(rel.split('/')[0] || '').trim();
        if (first) {
          rootName = first;
          break;
        }
      }
      const imported = inferGptSoVitsModelsFromFolderFiles(files, importPrefix, { relativeRootName: rootName });
      if (!imported.length) {
        showToast('未识别到可导入模型（至少需要参考音频）');
        return;
      }
      if (!window.confirm(`识别到 ${imported.length} 个模型，是否导入？`)) return;
      const next = models.slice();
      let replaced = 0;
      imported.forEach(model => {
        const incomingName = _normalizeModelMatchKey(model?.name);
        const incomingId = _normalizeModelMatchKey(model?.id);
        const idx = next.findIndex(item => {
          const currentName = _normalizeModelMatchKey(item?.name);
          const currentId = _normalizeModelMatchKey(item?.id);
          if (incomingName && currentName === incomingName) return true;
          if (incomingId && currentId === incomingId) return true;
          return false;
        });
        if (idx >= 0) {
          next[idx] = model;
          replaced += 1;
        } else {
          next.push(model);
        }
      });
      await saveModels(next);
      showToast(replaced > 0 ? `已导入 ${imported.length} 条，覆盖同名 ${replaced} 条` : `已导入模型 ${imported.length} 条`);
    } catch (e) {
      console.warn(`[${SCRIPT_NAME}] GPT-SoVITS 模型导入失败:`, e);
      showToast('模型导入失败，请检查目录结构');
    } finally {
      $(this).val('');
    }
  });

  $modal.on('click', '[data-model-id] [data-action]', function () {
    const id = String($(this).closest('[data-model-id]').attr('data-model-id') || '').trim();
    const action = String($(this).attr('data-action') || '').trim();
    const index = models.findIndex(item => item.id === id);
    if (index < 0) return;
    const target = models[index];
    if (action === 'edit') {
      _openModelEditor(target, async model => {
        const next = models.slice();
        next[index] = model;
        await saveModels(next);
        showToast(`已更新模型：${model.name}`);
      });
      return;
    }
    if (action === 'preview') {
      void _previewModel(target, String(target?.params?.promptText || '').trim() || '你好，这是模型试听。');
      return;
    }
    if (action === 'copy') {
      const copied = Object.assign({}, JSON.parse(JSON.stringify(target || {})), {
        id: buildGptSoVitsModelId(target.name || 'model'),
        name: `${target.name}_副本`,
      });
      void saveModels(models.concat([copied])).then(() => showToast(`已复制模型：${copied.name}`));
      return;
    }
    if (action === 'set-default') {
      const settings = getSettings();
      settings.ttsDefaultSpeaker = target.name;
      saveSettings();
      showToast(`默认音色已切换为：${target.name}`);
      if (typeof onChanged === 'function') void onChanged(models);
      return;
    }
    if (action === 'delete') {
      if (!window.confirm(`确定删除模型「${target.name}」吗？`)) return;
      const next = models.filter(item => item.id !== id);
      void saveModels(next).then(() => showToast(`已删除模型：${target.name}`));
    }
  });

  renderList();
}
