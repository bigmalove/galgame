export const LIVE2D_RUNTIME_TYPES = Object.freeze({
  LEGACY: 'legacy',
  CUBISM5: 'cubism5',
});

const RUNTIME_TYPE_SET = new Set(Object.values(LIVE2D_RUNTIME_TYPES));

function parseMajorVersion(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value !== 'string') return null;
  const match = value.trim().match(/(\d+)(?:\.\d+)?/);
  if (!match) return null;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : null;
}

export function normalizeCubismVersion(value) {
  const major = parseMajorVersion(value);
  if (major == null) return null;
  if (major >= 5) return 5;
  if (major >= 3) return 4;
  if (major === 2) return 2;
  return null;
}

export function inferCubismVersionFromModelJson(modelJson, fallback = null) {
  if (!modelJson || typeof modelJson !== 'object') {
    return normalizeCubismVersion(fallback);
  }

  const directCandidates = [
    modelJson.Version,
    modelJson.version,
    modelJson?.Meta?.Version,
    modelJson?.meta?.version,
  ];
  for (const candidate of directCandidates) {
    const parsed = normalizeCubismVersion(candidate);
    if (parsed != null) return parsed;
  }

  if (modelJson.FileReferences && typeof modelJson.FileReferences === 'object') {
    return normalizeCubismVersion(fallback) ?? 4;
  }

  if (typeof modelJson.model === 'string' || typeof modelJson.Model === 'string') {
    return normalizeCubismVersion(fallback) ?? 2;
  }

  return normalizeCubismVersion(fallback);
}

export function normalizeLive2DRuntimeType(value, fallback = LIVE2D_RUNTIME_TYPES.LEGACY) {
  const normalized = String(value || '').trim().toLowerCase();
  if (RUNTIME_TYPE_SET.has(normalized)) return normalized;
  return fallback;
}

export function resolveRuntimeTypeFromCubismVersion(cubismVersion) {
  const normalized = normalizeCubismVersion(cubismVersion);
  if (normalized != null && normalized >= 5) {
    return LIVE2D_RUNTIME_TYPES.CUBISM5;
  }
  return LIVE2D_RUNTIME_TYPES.LEGACY;
}

export function resolveLive2DRuntime(modelData = null) {
  const input = modelData && typeof modelData === 'object' ? modelData : {};
  const inferredVersion = inferCubismVersionFromModelJson(input.modelJson, input.cubismVersion);
  const explicitRuntime = normalizeLive2DRuntimeType(input.runtimeType || '', '');
  const runtimeType = explicitRuntime || resolveRuntimeTypeFromCubismVersion(inferredVersion);
  const cubismVersion =
    inferredVersion ??
    (runtimeType === LIVE2D_RUNTIME_TYPES.CUBISM5 ? 5 : null);

  return {
    runtimeType,
    cubismVersion,
  };
}

export function withResolvedLive2DRuntime(modelData = null) {
  const input = modelData && typeof modelData === 'object' ? modelData : {};
  const resolved = resolveLive2DRuntime(input);
  return {
    ...input,
    runtimeType: resolved.runtimeType,
    cubismVersion: resolved.cubismVersion,
  };
}
