import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { dirname, resolve, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createGroqMiddleware } from './groqProxy.mjs';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDir = resolve(rootDir, 'dist');
const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535.');
if (!existsSync(resolve(distDir, 'index.html'))) throw new Error('먼저 npm run build를 실행해주세요.');
const mimeTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' };
const proxy = createGroqMiddleware({ rootDir });

const server = createServer((req, res) => {
  proxy(req, res, () => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (pathname.startsWith('/api/') || pathname.split('/').some(p => p.startsWith('.'))) { res.writeHead(404).end(); return; }
      let file = resolve(distDir, `.${pathname}`);
      if (relative(distDir, file).startsWith('..')) { res.writeHead(403).end(); return; }
      if (!existsSync(file) || !statSync(file).isFile()) {
        if (extname(pathname)) { res.writeHead(404).end(); return; }
        file = resolve(distDir, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
      if (req.method === 'HEAD') { res.end(); return; }
      const stream = createReadStream(file);
      stream.on('error', () => res.destroy());
      stream.pipe(res);
    } catch { res.writeHead(400).end(); }
  }).catch(() => {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'SERVER_ERROR', message: '서버 요청을 처리하지 못했습니다.' } }));
  });
});
server.listen(port, '127.0.0.1', () => console.log(`DocuClear: http://127.0.0.1:${port}`));
