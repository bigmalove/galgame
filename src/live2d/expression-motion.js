import { SCRIPT_NAME } from '../core/constants.js';
import { Live2DManager } from './manager.js';
import { getLive2DConfig } from './render-mode.js';

// ============================================
// Live2D 表情动画映射增强
// ============================================
export const EXPRESSION_LIVE2D_MAP = {
  '默认': {
    expressions: ['normal', 'default', 'neutral', 'idle', 'base'],
    motions: ['idle', 'normal', 'wait']
  },
  '微笑': {
    expressions: ['smile', 'happy', 'joy', 'glad', 'pleased'],
    motions: ['happy', 'smile', 'joy']
  },
  '生气': {
    expressions: ['angry', 'anger', 'mad', 'rage', 'annoyed'],
    motions: ['angry', 'rage', 'mad']
  },
  '难过': {
    expressions: ['sad', 'sorrow', 'cry', 'upset', 'depressed'],
    motions: ['sad', 'cry', 'sorrow']
  },
  '惊讶': {
    expressions: ['surprised', 'shock', 'amazed', 'wow', 'astonished'],
    motions: ['surprised', 'shock', 'amazed']
  },
  '嘲讽': {
    expressions: ['smirk', 'mock', 'sneer', 'tease', 'sarcastic'],
    motions: ['mock', 'tease']
  },
  '害羞': {
    expressions: ['shy', 'blush', 'embarrassed', 'bashful', 'timid'],
    motions: ['shy', 'embarrassed', 'blush']
  },
  '思考': {
    expressions: ['think', 'ponder', 'confused', 'wonder', 'curious'],
    motions: ['think', 'ponder', 'wonder']
  },
  '大笑': {
    expressions: ['laugh', 'lol', 'haha', 'giggle', 'rofl'],
    motions: ['laugh', 'giggle', 'haha']
  },
  '搞怪': {
    expressions: ['playful', 'wink', 'silly', 'fun', 'mischievous'],
    motions: ['playful', 'wink', 'fun']
  },
};

function uniquePush(list, seen, value) {
  const normalized = String(value ?? '').trim();
  if (!normalized || seen.has(normalized)) return;
  seen.add(normalized);
  list.push(normalized);
}

function normalizeFileStem(input) {
  const raw = String(input ?? '').trim();
  if (!raw) return '';

  const noHash = raw.split('#')[0];
  const noQuery = noHash.split('?')[0];
  const filePart = noQuery.split('/').pop() || noQuery;
  let decoded = filePart;
  try {
    decoded = decodeURIComponent(filePart);
  } catch (e) {}

  return decoded
    .replace(/\.exp3\.json$/i, '')
    .replace(/\.motion3\.json$/i, '')
    .replace(/\.mtn$/i, '')
    .replace(/\.json$/i, '')
    .trim();
}

function normalizeDefinitionName(def, fallback = '') {
  if (typeof def === 'string') {
    return normalizeFileStem(def) || def.trim();
  }
  if (!def || typeof def !== 'object') {
    return fallback;
  }

  const directName = def.Name || def.name || def.Id || def.id || '';
  if (String(directName ?? '').trim()) {
    return String(directName).trim();
  }

  const fileLike = def.File || def.file || def.Path || def.path || '';
  const stem = normalizeFileStem(fileLike);
  if (stem) return stem;

  return fallback;
}

function collectSettingsCandidates(model) {
  const candidates = [];
  const seen = new Set();

  const add = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    if (seen.has(obj)) return;
    seen.add(obj);
    candidates.push(obj);
  };

  const motionManager = model?.internalModel?.motionManager;
  const settings = model?.internalModel?.settings;

  add(settings);
  add(settings?.json);
  add(settings?.rawSettings);
  add(settings?.modelJson);
  add(motionManager?.settings);
  add(motionManager?.settings?.json);
  add(motionManager?.settings?.rawSettings);
  add(motionManager?.settings?.modelJson);

  return candidates;
}

function collectExpressionNames(model) {
  const names = [];
  const seen = new Set();
  const expressionManager = model?.internalModel?.motionManager?.expressionManager;

  const pushFromList = (list, fallbackPrefix = 'expression') => {
    if (!Array.isArray(list)) return;
    for (let i = 0; i < list.length; i++) {
      const normalized = normalizeDefinitionName(list[i], `${fallbackPrefix}_${i + 1}`);
      uniquePush(names, seen, normalized);
    }
  };
  const pushFromContainer = (container, fallbackPrefix = 'expression') => {
    if (Array.isArray(container)) {
      pushFromList(container, fallbackPrefix);
      return;
    }
    if (!container || typeof container !== 'object') return;

    let i = 0;
    for (const [key, value] of Object.entries(container)) {
      const fallbackName = normalizeFileStem(key) || String(key || '').trim() || `${fallbackPrefix}_${i + 1}`;
      const normalized = normalizeDefinitionName(value, fallbackName);
      uniquePush(names, seen, normalized || fallbackName);
      i++;
    }
  };

  pushFromContainer(expressionManager?.definitions, 'definition');
  pushFromContainer(expressionManager?.expressions, 'expression');

  const settingsCandidates = collectSettingsCandidates(model);
  for (const settings of settingsCandidates) {
    pushFromContainer(settings?.expressions, 'settings_expr');
    pushFromContainer(settings?.Expressions, 'settings_expr');
    pushFromContainer(settings?.FileReferences?.Expressions, 'file_ref_expr');
  }

  const settings = model?.internalModel?.settings;
  if (settings && typeof settings === 'object') {
    if (typeof settings.getExpressionCount === 'function') {
      let count = 0;
      try {
        count = Number(settings.getExpressionCount()) || 0;
      } catch (e) {}
      count = Math.max(0, Math.min(count, 1000));

      for (let i = 0; i < count; i++) {
        let name = '';
        if (typeof settings.getExpressionName === 'function') {
          try {
            name = String(settings.getExpressionName(i) ?? '').trim();
          } catch (e) {}
        }
        if (!name && typeof settings.getExpressionFile === 'function') {
          try {
            name = normalizeFileStem(settings.getExpressionFile(i));
          } catch (e) {}
        }
        uniquePush(names, seen, name || `expression_${i + 1}`);
      }
    }
  }

  return names;
}

function collectMotionGroupNames(model) {
  const groupNames = [];
  const seen = new Set();
  const motionManager = model?.internalModel?.motionManager;

  const pushFromObject = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      uniquePush(groupNames, seen, key);
    }
  };

  pushFromObject(motionManager?.motionGroups);
  pushFromObject(motionManager?.groups);
  pushFromObject(motionManager?.definitions);

  const settingsCandidates = collectSettingsCandidates(model);
  for (const settings of settingsCandidates) {
    pushFromObject(settings?.motions);
    pushFromObject(settings?.Motions);
    pushFromObject(settings?.FileReferences?.Motions);
  }

  const settings = model?.internalModel?.settings;
  if (settings && typeof settings === 'object') {
    if (typeof settings.getMotionGroupCount === 'function' && typeof settings.getMotionGroupName === 'function') {
      let count = 0;
      try {
        count = Number(settings.getMotionGroupCount()) || 0;
      } catch (e) {}
      count = Math.max(0, Math.min(count, 1000));

      for (let i = 0; i < count; i++) {
        try {
          uniquePush(groupNames, seen, String(settings.getMotionGroupName(i) ?? ''));
        } catch (e) {}
      }
    } else if (typeof settings.getMotionGroupNames === 'function') {
      try {
        const names = settings.getMotionGroupNames();
        if (Array.isArray(names)) {
          for (const name of names) uniquePush(groupNames, seen, name);
        }
      } catch (e) {}
    }
  }

  return groupNames;
}

// 智能匹配 Live2D 表情 (支持用户自定义映射)
export function matchLive2DExpression(model, targetExpression, characterId = null) {
  if (characterId) {
    const config = getLive2DConfig(characterId);
    const userMapping = config.expressionMapping || {};
    if (userMapping[targetExpression]) {
      return userMapping[targetExpression];
    }
  }

  const mapping = EXPRESSION_LIVE2D_MAP[targetExpression];
  const candidates = mapping?.expressions || [targetExpression.toLowerCase()];

  try {
    const definitions = collectExpressionNames(model);
    if (!definitions.length) return null;

    for (const candidate of candidates) {
      for (const def of definitions) {
        const name = String(def || '').toLowerCase();
        if (name === candidate) {
          return def;
        }
      }
    }

    for (const candidate of candidates) {
      for (const def of definitions) {
        const name = String(def || '').toLowerCase();
        if (name.includes(candidate) || candidate.includes(name)) {
          return def;
        }
      }
    }

    return definitions[0] || null;
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] 表情匹配失败:`, e);
    return null;
  }
}

// 智能匹配 Live2D 动作 (支持用户自定义映射)
export function matchLive2DMotion(model, targetExpression, characterId = null) {
  if (characterId) {
    const config = getLive2DConfig(characterId);
    const userMotionMapping = config.motionMapping || {};
    if (userMotionMapping[targetExpression]) {
      const motionConfig = userMotionMapping[targetExpression];
      if (motionConfig.enabled !== false && Object.prototype.hasOwnProperty.call(motionConfig, 'group')) {
        return { group: String(motionConfig.group ?? ''), index: motionConfig.index || 0 };
      }
      if (motionConfig.enabled === false) {
        return null;
      }
    }
  }

  const mapping = EXPRESSION_LIVE2D_MAP[targetExpression];
  if (!mapping?.motions?.length) return null;

  try {
    const groupNames = collectMotionGroupNames(model);
    if (!groupNames.length) return null;

    for (const candidate of mapping.motions) {
      const exact = groupNames.find(name => name === candidate);
      if (exact !== undefined) {
        return { group: exact, index: 0 };
      }
    }

    for (const candidate of mapping.motions) {
      for (const groupName of groupNames) {
        if (groupName.toLowerCase().includes(candidate.toLowerCase())) {
          return { group: groupName, index: 0 };
        }
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}

// 设置角色表情（表情 + 动作联动）
export function setLive2DCharacterExpression(characterId, expressionName, playMotion = true) {
  const model = Live2DManager.models.get(characterId);
  if (!model) return false;

  const expr = matchLive2DExpression(model, expressionName, characterId);
  if (expr) {
    try {
      model.expression(expr);
    } catch (e) {}
  }

  if (playMotion) {
    const motion = matchLive2DMotion(model, expressionName, characterId);
    if (motion) {
      try {
        model.motion(motion.group, motion.index, 'NORMAL');
      } catch (e) {}
    }
  }

  return true;
}

// 获取模型支持的表情列表
export function getLive2DExpressionList(characterId) {
  const model = Live2DManager.models.get(characterId);
  if (!model) return [];

  try {
    const definitions = collectExpressionNames(model);

    console.log(`[${SCRIPT_NAME}] getLive2DExpressionList: 找到 ${definitions.length} 个表情定义`, definitions);

    return definitions;
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] getLive2DExpressionList 错误:`, e);
    return [];
  }
}

// 获取模型支持的动作组列表
export function getLive2DMotionGroups(characterId) {
  const model = Live2DManager.models.get(characterId);
  if (!model) return [];

  try {
    const groupNames = collectMotionGroupNames(model);
    console.log(`[${SCRIPT_NAME}] getLive2DMotionGroups: 找到 ${groupNames.length} 个动作组`, groupNames);

    return groupNames;
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] getLive2DMotionGroups 错误:`, e);
    return [];
  }
}
