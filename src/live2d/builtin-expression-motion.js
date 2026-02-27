export const BUILTIN_EXPR_TOKEN_PREFIX = '__builtin_expr__:';
export const BUILTIN_MOTION_TOKEN_PREFIX = '__builtin_motion__:';

const BUILTIN_EXPRESSION_DEFS = [
  {
    key: 'default',
    label: '内置·默认',
    fadeIn: 0.24,
    fadeOut: 0.24,
    parameters: {
      ParamAngleX: 0,
      ParamAngleY: 0,
      ParamAngleZ: 0,
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1,
      ParamEyeLSmile: 0,
      ParamEyeRSmile: 0,
      ParamEyeBallX: 0,
      ParamEyeBallY: 0,
      ParamBrowLY: 0,
      ParamBrowRY: 0,
      ParamBrowLX: 0,
      ParamBrowRX: 0,
      ParamBrowLAngle: 0,
      ParamBrowRAngle: 0,
      ParamBrowLForm: 0,
      ParamBrowRForm: 0,
      ParamMouthForm: 0,
      ParamMouthOpenY: 0,
      ParamCheek: 0,
      ParamBodyAngleX: 0,
      ParamBodyAngleY: 0,
      ParamBodyAngleZ: 0,
    },
  },
  {
    key: 'smile',
    label: '内置·微笑',
    fadeIn: 0.22,
    fadeOut: 0.2,
    parameters: {
      ParamEyeLOpen: 0.88,
      ParamEyeROpen: 0.88,
      ParamEyeLSmile: 0.72,
      ParamEyeRSmile: 0.72,
      ParamBrowLY: 0.22,
      ParamBrowRY: 0.22,
      ParamMouthForm: 0.62,
      ParamMouthOpenY: 0.22,
      ParamCheek: 0.35,
    },
  },
  {
    key: 'angry',
    label: '内置·生气',
    fadeIn: 0.18,
    fadeOut: 0.16,
    parameters: {
      ParamEyeLOpen: 0.72,
      ParamEyeROpen: 0.72,
      ParamBrowLY: -0.24,
      ParamBrowRY: -0.24,
      ParamBrowLX: 0.52,
      ParamBrowRX: -0.52,
      ParamBrowLAngle: -0.84,
      ParamBrowRAngle: -0.84,
      ParamMouthForm: -0.72,
      ParamMouthOpenY: 0.34,
      ParamAngleZ: 0.1,
    },
  },
  {
    key: 'sad',
    label: '内置·难过',
    fadeIn: 0.2,
    fadeOut: 0.2,
    parameters: {
      ParamEyeLOpen: 0.56,
      ParamEyeROpen: 0.56,
      ParamBrowLY: -0.12,
      ParamBrowRY: -0.12,
      ParamBrowLAngle: 0.35,
      ParamBrowRAngle: 0.35,
      ParamMouthForm: -0.44,
      ParamMouthOpenY: 0.08,
      ParamBodyAngleX: -0.12,
    },
  },
  {
    key: 'surprised',
    label: '内置·惊讶',
    fadeIn: 0.12,
    fadeOut: 0.16,
    parameters: {
      ParamEyeLOpen: 1,
      ParamEyeROpen: 1,
      ParamEyeBallY: 0.25,
      ParamBrowLY: 0.66,
      ParamBrowRY: 0.66,
      ParamMouthForm: 0.2,
      ParamMouthOpenY: 0.92,
      ParamBodyAngleY: 0.12,
    },
  },
  {
    key: 'smirk',
    label: '内置·嘲讽',
    fadeIn: 0.18,
    fadeOut: 0.16,
    parameters: {
      ParamEyeLOpen: 0.82,
      ParamEyeROpen: 0.72,
      ParamEyeLSmile: 0.4,
      ParamEyeRSmile: 0.08,
      ParamBrowLY: 0.18,
      ParamBrowRY: 0.04,
      ParamMouthForm: 0.44,
      ParamMouthOpenY: 0.12,
      ParamAngleZ: 0.14,
    },
  },
  {
    key: 'shy',
    label: '内置·害羞',
    fadeIn: 0.2,
    fadeOut: 0.22,
    parameters: {
      ParamEyeLOpen: 0.66,
      ParamEyeROpen: 0.66,
      ParamEyeLSmile: 0.45,
      ParamEyeRSmile: 0.45,
      ParamBrowLY: 0.18,
      ParamBrowRY: 0.18,
      ParamMouthForm: 0.22,
      ParamMouthOpenY: 0.14,
      ParamCheek: 0.86,
      ParamAngleY: -0.14,
      ParamBodyAngleZ: -0.18,
    },
  },
  {
    key: 'thinking',
    label: '内置·思考',
    fadeIn: 0.2,
    fadeOut: 0.2,
    parameters: {
      ParamEyeLOpen: 0.84,
      ParamEyeROpen: 0.84,
      ParamEyeBallX: -0.32,
      ParamEyeBallY: 0.28,
      ParamBrowLY: 0.32,
      ParamBrowRY: 0.32,
      ParamMouthForm: -0.08,
      ParamMouthOpenY: 0,
      ParamAngleY: -0.12,
    },
  },
  {
    key: 'laugh',
    label: '内置·大笑',
    fadeIn: 0.14,
    fadeOut: 0.18,
    parameters: {
      ParamEyeLOpen: 0.2,
      ParamEyeROpen: 0.2,
      ParamEyeLSmile: 1,
      ParamEyeRSmile: 1,
      ParamBrowLY: 0.36,
      ParamBrowRY: 0.36,
      ParamMouthForm: 0.85,
      ParamMouthOpenY: 0.95,
      ParamCheek: 0.4,
      ParamAngleY: 0.08,
    },
  },
  {
    key: 'playful',
    label: '内置·搞怪',
    fadeIn: 0.16,
    fadeOut: 0.16,
    parameters: {
      ParamEyeLOpen: 0.24,
      ParamEyeROpen: 1,
      ParamEyeLSmile: 0.65,
      ParamEyeBallX: 0.42,
      ParamMouthForm: 0.7,
      ParamMouthOpenY: 0.42,
      ParamBrowLY: 0.24,
      ParamBrowRY: 0.08,
      ParamAngleZ: 0.26,
    },
  },
];

const BUILTIN_MOTION_DEFS = [
  {
    key: 'idle_breath',
    label: '内置·呼吸',
    durationMs: 2200,
    loop: true,
    easing: 'easeInOut',
    keyframes: [
      { t: 0, params: { ParamBodyAngleY: 0, ParamBodyAngleX: 0, ParamAngleX: 0, ParamMouthOpenY: 0 } },
      { t: 0.25, params: { ParamBodyAngleY: 0.08, ParamBodyAngleX: -0.04, ParamAngleX: -0.05, ParamMouthOpenY: 0.04 } },
      { t: 0.5, params: { ParamBodyAngleY: 0, ParamBodyAngleX: 0, ParamAngleX: 0, ParamMouthOpenY: 0 } },
      { t: 0.75, params: { ParamBodyAngleY: -0.06, ParamBodyAngleX: 0.03, ParamAngleX: 0.04, ParamMouthOpenY: 0.02 } },
      { t: 1, params: { ParamBodyAngleY: 0, ParamBodyAngleX: 0, ParamAngleX: 0, ParamMouthOpenY: 0 } },
    ],
  },
  {
    key: 'nod',
    label: '内置·点头',
    durationMs: 760,
    loop: false,
    easing: 'easeOut',
    keyframes: [
      { t: 0, params: { ParamAngleY: 0, ParamBodyAngleY: 0, ParamAngleZ: 0 } },
      { t: 0.35, params: { ParamAngleY: -0.46, ParamBodyAngleY: -0.24, ParamAngleZ: 0.02 } },
      { t: 0.65, params: { ParamAngleY: 0.28, ParamBodyAngleY: 0.1, ParamAngleZ: -0.02 } },
      { t: 1, params: { ParamAngleY: 0, ParamBodyAngleY: 0, ParamAngleZ: 0 } },
    ],
  },
  {
    key: 'shake_head',
    label: '内置·摇头',
    durationMs: 940,
    loop: false,
    easing: 'easeInOut',
    keyframes: [
      { t: 0, params: { ParamAngleX: 0, ParamAngleZ: 0, ParamBodyAngleX: 0 } },
      { t: 0.2, params: { ParamAngleX: 0.5, ParamAngleZ: 0.1, ParamBodyAngleX: 0.16 } },
      { t: 0.45, params: { ParamAngleX: -0.56, ParamAngleZ: -0.12, ParamBodyAngleX: -0.2 } },
      { t: 0.7, params: { ParamAngleX: 0.34, ParamAngleZ: 0.08, ParamBodyAngleX: 0.12 } },
      { t: 1, params: { ParamAngleX: 0, ParamAngleZ: 0, ParamBodyAngleX: 0 } },
    ],
  },
  {
    key: 'tilt_body',
    label: '内置·侧倾',
    durationMs: 980,
    loop: false,
    easing: 'easeInOut',
    keyframes: [
      { t: 0, params: { ParamBodyAngleZ: 0, ParamAngleZ: 0, ParamBodyAngleX: 0 } },
      { t: 0.35, params: { ParamBodyAngleZ: 0.36, ParamAngleZ: 0.2, ParamBodyAngleX: -0.08 } },
      { t: 0.7, params: { ParamBodyAngleZ: -0.14, ParamAngleZ: -0.08, ParamBodyAngleX: 0.04 } },
      { t: 1, params: { ParamBodyAngleZ: 0, ParamAngleZ: 0, ParamBodyAngleX: 0 } },
    ],
  },
  {
    key: 'surprised_back',
    label: '内置·后仰惊讶',
    durationMs: 820,
    loop: false,
    easing: 'easeOut',
    keyframes: [
      { t: 0, params: { ParamBodyAngleY: 0, ParamAngleX: 0, ParamMouthOpenY: 0.1 } },
      { t: 0.28, params: { ParamBodyAngleY: 0.4, ParamAngleX: 0.24, ParamMouthOpenY: 0.88 } },
      { t: 0.68, params: { ParamBodyAngleY: 0.12, ParamAngleX: 0.08, ParamMouthOpenY: 0.42 } },
      { t: 1, params: { ParamBodyAngleY: 0, ParamAngleX: 0, ParamMouthOpenY: 0.16 } },
    ],
  },
];

const BUILTIN_EXPRESSION_TAG_MAP = {
  默认: 'default',
  微笑: 'smile',
  生气: 'angry',
  难过: 'sad',
  惊讶: 'surprised',
  嘲讽: 'smirk',
  害羞: 'shy',
  思考: 'thinking',
  大笑: 'laugh',
  搞怪: 'playful',
};

const BUILTIN_MOTION_TAG_MAP = {
  默认: 'idle_breath',
  微笑: 'nod',
  生气: 'shake_head',
  难过: 'tilt_body',
  惊讶: 'surprised_back',
  嘲讽: 'shake_head',
  害羞: 'tilt_body',
  思考: 'nod',
  大笑: 'nod',
  搞怪: 'shake_head',
};

const BUILTIN_EXPRESSIONS_BY_KEY = new Map(BUILTIN_EXPRESSION_DEFS.map(item => [item.key, item]));
const BUILTIN_MOTIONS_BY_KEY = new Map(BUILTIN_MOTION_DEFS.map(item => [item.key, item]));

function normalizeTokenValue(raw, prefix) {
  const text = String(raw || '').trim();
  if (!text.toLowerCase().startsWith(prefix.toLowerCase())) return '';
  return text.slice(prefix.length).trim();
}

export function makeBuiltinExpressionToken(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return '';
  return `${BUILTIN_EXPR_TOKEN_PREFIX}${normalized}`;
}

export function makeBuiltinMotionToken(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return '';
  return `${BUILTIN_MOTION_TOKEN_PREFIX}${normalized}`;
}

export function parseBuiltinExpressionToken(value) {
  const key = normalizeTokenValue(value, BUILTIN_EXPR_TOKEN_PREFIX);
  return BUILTIN_EXPRESSIONS_BY_KEY.has(key) ? key : '';
}

export function parseBuiltinMotionToken(value) {
  const key = normalizeTokenValue(value, BUILTIN_MOTION_TOKEN_PREFIX);
  return BUILTIN_MOTIONS_BY_KEY.has(key) ? key : '';
}

export function isBuiltinExpressionToken(value) {
  return !!parseBuiltinExpressionToken(value);
}

export function isBuiltinMotionToken(value) {
  return !!parseBuiltinMotionToken(value);
}

export function getBuiltinExpressionByKey(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return null;
  return BUILTIN_EXPRESSIONS_BY_KEY.get(normalized) || null;
}

export function getBuiltinMotionByKey(key) {
  const normalized = String(key || '').trim();
  if (!normalized) return null;
  return BUILTIN_MOTIONS_BY_KEY.get(normalized) || null;
}

export function getBuiltinExpressionForTag(tag) {
  const key = BUILTIN_EXPRESSION_TAG_MAP[String(tag || '').trim()] || BUILTIN_EXPRESSION_TAG_MAP.默认;
  return getBuiltinExpressionByKey(key);
}

export function getBuiltinMotionForTag(tag) {
  const key = BUILTIN_MOTION_TAG_MAP[String(tag || '').trim()] || BUILTIN_MOTION_TAG_MAP.默认;
  return getBuiltinMotionByKey(key);
}

export function getBuiltinExpressionOptions() {
  return BUILTIN_EXPRESSION_DEFS.map(item => ({
    key: item.key,
    label: item.label,
    token: makeBuiltinExpressionToken(item.key),
  }));
}

export function getBuiltinMotionOptions() {
  return BUILTIN_MOTION_DEFS.map(item => ({
    key: item.key,
    label: item.label,
    token: makeBuiltinMotionToken(item.key),
  }));
}
