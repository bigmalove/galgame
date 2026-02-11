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
    const expressionManager = model.internalModel?.motionManager?.expressionManager;
    if (!expressionManager?.definitions) return null;

    const definitions = expressionManager.definitions;

    for (const candidate of candidates) {
      for (const def of definitions) {
        const name = (def.Name || def.name || '').toLowerCase();
        if (name === candidate) {
          return def.Name || def.name;
        }
      }
    }

    for (const candidate of candidates) {
      for (const def of definitions) {
        const name = (def.Name || def.name || '').toLowerCase();
        if (name.includes(candidate) || candidate.includes(name)) {
          return def.Name || def.name;
        }
      }
    }

    return definitions[0]?.Name || definitions[0]?.name || null;
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
      if (motionConfig.enabled !== false && motionConfig.group) {
        return { group: motionConfig.group, index: motionConfig.index || 0 };
      }
      if (motionConfig.enabled === false) {
        return null;
      }
    }
  }

  const mapping = EXPRESSION_LIVE2D_MAP[targetExpression];
  if (!mapping?.motions?.length) return null;

  try {
    const motionManager = model.internalModel?.motionManager;
    if (!motionManager) return null;

    const groups = motionManager.motionGroups || motionManager.groups || {};
    const groupNames = Object.keys(groups);

    for (const candidate of mapping.motions) {
      if (groups[candidate]) {
        return { group: candidate, index: 0 };
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
    const expressionManager = model.internalModel?.motionManager?.expressionManager;

    let definitions = expressionManager?.definitions
      || expressionManager?.expressions
      || model.internalModel?.settings?.expressions
      || [];

    if (definitions.length === 0) {
      const settings = model.internalModel?.settings;
      if (settings?.expressions) {
        definitions = settings.expressions;
      }
    }

    console.log(`[${SCRIPT_NAME}] getLive2DExpressionList: 找到 ${definitions.length} 个表情定义`, definitions);

    return definitions.map(def => def.Name || def.name || def.File || '').filter(Boolean);
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
    const motionManager = model.internalModel?.motionManager;
    if (!motionManager) {
      console.log(`[${SCRIPT_NAME}] getLive2DMotionGroups: motionManager 不存在`);
      return [];
    }

    let groups = motionManager.motionGroups
      || motionManager.groups
      || motionManager.definitions
      || {};

    if (Object.keys(groups).length === 0) {
      const settings = model.internalModel?.settings;
      if (settings?.motions) {
        groups = settings.motions;
      }
    }

    const groupNames = Object.keys(groups);
    console.log(`[${SCRIPT_NAME}] getLive2DMotionGroups: 找到 ${groupNames.length} 个动作组`, groupNames);

    return groupNames;
  } catch (e) {
    console.warn(`[${SCRIPT_NAME}] getLive2DMotionGroups 错误:`, e);
    return [];
  }
}
