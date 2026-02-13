const GITHUB_OWNER = 'Eikanya';
const GITHUB_REPO = 'Live2d-model';
const GITHUB_CONTENTS_API = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents`;

const _directoryCache = new Map();

function isModelFileName(fileName) {
  const name = String(fileName || '').toLowerCase();
  return (
    name === 'model3.json' ||
    name === 'model.json' ||
    name.endsWith('.model3.json') ||
    name.endsWith('.model.json')
  );
}

function normalizeDirectoryPath(path = '') {
  return String(path || '')
    .trim()
    .replace(/^\/+|\/+$/g, '');
}

function encodePathSegment(segment) {
  if (typeof segment !== 'string' || !segment) return segment;

  let decoded = segment;
  try {
    decoded = decodeURIComponent(segment);
  } catch (e) {
    return segment;
  }

  const safeChar = /[A-Za-z0-9\-._~!$&'()*+,;=:@]/;
  let encoded = '';
  for (const ch of decoded) {
    encoded += safeChar.test(ch) ? ch : encodeURIComponent(ch);
  }
  return encoded;
}

function normalizeRemoteUrl(inputUrl) {
  const url = String(inputUrl || '').trim();
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    urlObj.pathname = urlObj.pathname
      .split('/')
      .map(segment => encodePathSegment(segment))
      .join('/');
    return urlObj.toString();
  } catch (e) {
    return url;
  }
}

function formatApiPath(path = '') {
  const normalized = normalizeDirectoryPath(path);
  if (!normalized) return '';
  return normalized
    .split('/')
    .filter(Boolean)
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function parseRateLimitError(response) {
  const remainingHeader = response.headers.get('x-ratelimit-remaining');
  const resetHeader = response.headers.get('x-ratelimit-reset');
  const remaining = Number.parseInt(remainingHeader ?? '', 10);
  const resetUnix = Number.parseInt(resetHeader ?? '', 10);
  const resetAt = Number.isFinite(resetUnix) ? new Date(resetUnix * 1000) : null;
  return {
    remaining: Number.isFinite(remaining) ? remaining : null,
    resetAt,
  };
}

export class RateLimitError extends Error {
  constructor(remaining = null, resetAt = null) {
    const resetText = resetAt instanceof Date ? `，重置时间: ${resetAt.toLocaleString()}` : '';
    super(`GitHub API 访问频率已达上限${resetText}`);
    this.name = 'RateLimitError';
    this.remaining = remaining;
    this.resetAt = resetAt;
  }
}

export function clearLive2DDirectoryCache() {
  _directoryCache.clear();
}

export async function fetchLive2DDirectory(path = '') {
  const normalizedPath = normalizeDirectoryPath(path);
  if (_directoryCache.has(normalizedPath)) {
    return _directoryCache.get(normalizedPath);
  }

  const apiPath = formatApiPath(normalizedPath);
  const requestUrl = apiPath ? `${GITHUB_CONTENTS_API}/${apiPath}` : GITHUB_CONTENTS_API;

  const response = await fetch(requestUrl, {
    method: 'GET',
    headers: { Accept: 'application/vnd.github+json' },
    cache: 'no-store',
  });

  if (response.status === 403 || response.status === 429) {
    const { remaining, resetAt } = parseRateLimitError(response);
    if (remaining === 0 || response.status === 429) {
      throw new RateLimitError(remaining, resetAt);
    }
  }

  if (!response.ok) {
    throw new Error(`在线模型库请求失败: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (!Array.isArray(json)) {
    throw new Error('在线模型库返回格式异常');
  }

  const entries = json
    .filter(item => {
      if (!item || !item.type) return false;
      if (item.type === 'dir') return true;
      if (item.type === 'file') return isModelFileName(item.name);
      return false;
    })
    .map(item => ({
      type: item.type,
      name: item.name,
      path: normalizeDirectoryPath(item.path || ''),
      htmlUrl: item.html_url || '',
      downloadUrl: item.download_url || '',
    }))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }
      return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hans-CN', { sensitivity: 'base' });
    });

  _directoryCache.set(normalizedPath, entries);
  return entries;
}

export function normalizeUserModelUrl(inputUrl) {
  const raw = String(inputUrl || '').trim();
  if (!raw) return '';

  let value = raw;
  if (/^raw\.githubusercontent\.com\//i.test(value)) {
    value = `https://${value}`;
  }

  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)) {
    return value;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);

    if (host === 'github.com' && parts.length >= 5 && (parts[2] === 'blob' || parts[2] === 'raw' || parts[2] === 'tree')) {
      const owner = parts[0];
      const repo = parts[1];
      const branch = parts[3];
      const filePath = parts.slice(4).map(seg => encodePathSegment(seg)).join('/');
      const search = url.search || '';
      const hash = url.hash || '';
      return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}${search}${hash}`;
    }

    return normalizeRemoteUrl(url.toString());
  } catch (e) {
    return raw;
  }
}

export function looksLikeLive2DModelUrl(inputUrl) {
  const normalized = normalizeUserModelUrl(inputUrl);
  if (!normalized) return false;

  try {
    const url = new URL(normalized);
    const fileName = decodeURIComponent(url.pathname.split('/').pop() || '');
    return isModelFileName(fileName);
  } catch (e) {
    const plain = normalized.split('?')[0].split('#')[0].split('/').pop() || '';
    return isModelFileName(plain);
  }
}

export function buildLibraryModelUrl(entry, useCdn = true) {
  if (!entry || entry.type !== 'file') return '';

  const rawUrl = normalizeUserModelUrl(entry.downloadUrl || '');
  if (!rawUrl) return '';
  if (!useCdn) return rawUrl;

  const match = rawUrl.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i);
  if (!match) return rawUrl;

  const owner = match[1];
  const repo = match[2];
  const branch = match[3];
  const encodedPath = String(match[4] || '')
    .split('/')
    .filter(Boolean)
    .map(seg => encodePathSegment(seg))
    .join('/');

  return `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${encodedPath}`;
}
