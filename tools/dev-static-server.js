const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = process.env.GALGAME_DEV_HOST || '127.0.0.1';
const PORT = Number(process.env.GALGAME_DEV_PORT || '5500');
const ROOT_DIR = path.resolve(__dirname, '..');

const CONTENT_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'application/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Cache-Control': 'no-cache',
    'Content-Type': 'application/json; charset=utf-8',
  });
  if (payload) {
    res.end(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }
  res.end();
}

function getContentType(filePath) {
  return CONTENT_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function resolveFilePath(requestPathname) {
  const decodedPath = decodeURIComponent(String(requestPathname || '/'));
  const normalizedPath = decodedPath === '/' ? '/dist/数据库界面插件.dist.js' : decodedPath;
  const resolvedPath = path.resolve(ROOT_DIR, `.${normalizedPath}`);
  if (!resolvedPath.startsWith(ROOT_DIR)) {
    return null;
  }
  return resolvedPath;
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-cache',
    });
    res.end();
    return;
  }

  if (!['GET', 'HEAD'].includes(req.method || '')) {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }

  const filePath = resolveFilePath(req.url ? new URL(req.url, `http://${HOST}:${PORT}`).pathname : '/');
  if (!filePath) {
    sendJson(res, 403, { error: 'forbidden' });
    return;
  }

  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      sendJson(res, 404, { error: 'not_found', path: filePath });
      return;
    }

    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Cache-Control': 'no-cache',
      'Content-Length': stats.size,
      'Content-Type': getContentType(filePath),
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = fs.createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        sendJson(res, 500, { error: 'read_failed', path: filePath });
        return;
      }
      res.destroy();
    });
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`[galgame-dev-server] serving ${ROOT_DIR}`);
  console.log(`[galgame-dev-server] http://${HOST}:${PORT}/dist/数据库界面插件.dist.js`);
});
