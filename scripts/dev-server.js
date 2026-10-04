import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import contactHandler from '../api/contact.js';
import loginHandler from '../api/admin/login.js';
import logoutHandler from '../api/admin/logout.js';
import messagesHandler from '../api/admin/messages.js';
import replyHandler from '../api/admin/reply.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 4173);
const apiRoutes = new Map([
  ['/api/contact', contactHandler],
  ['/api/admin/login', loginHandler],
  ['/api/admin/logout', logoutHandler],
  ['/api/admin/messages', messagesHandler],
  ['/api/admin/reply', replyHandler],
]);
const contentTypes = new Map([
  ['.avif', 'image/avif'],
  ['.css', 'text/css; charset=utf-8'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.svg', 'image/svg+xml'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
]);

function setSecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self' mailto:; frame-ancestors 'none'");
}

function sendError(res, status, message) {
  if (res.headersSent) return res.end();
  res.statusCode = status;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(message);
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 20_000) throw new RangeError('Request too large.');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function serveApi(req, res, handler) {
  try {
    if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) req.body = await readJsonBody(req);
  } catch (error) {
    if (error instanceof RangeError) return sendError(res, 413, 'Request too large.');
    return sendError(res, 400, 'Invalid request body.');
  }
  const adapter = {
    status(code) {
      res.statusCode = code;
      return adapter;
    },
    json(payload) {
      if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(payload));
      return adapter;
    },
    setHeader(name, value) { res.setHeader(name, value); return adapter; },
    getHeader(name) { return res.getHeader(name); },
    end(value) { return res.end(value); },
  };
  try {
    await handler(req, adapter);
    if (!res.writableEnded) res.end();
  } catch {
    sendError(res, 500, 'The service is temporarily unavailable.');
  }
}

function isAllowedStaticPath(pathname) {
  if (pathname === '/' || pathname === '/index.html' || pathname === '/robots.txt' || pathname === '/sitemap.xml') return true;
  if (pathname === '/admin/inbox' || pathname === '/admin/inbox.html' || pathname === '/admin/admin.css' || pathname === '/admin/admin.js') return true;
  if (pathname === '/resume.pdf') return true;
  return pathname.startsWith('/assets/') || pathname.startsWith('/projects/');
}

function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405, 'Method not allowed.');
  const resolvedPath = pathname === '/admin/inbox' ? '/admin/inbox.html' : pathname;
  const relative = pathname === '/resume.pdf' ? 'public/resume.pdf' : resolvedPath === '/' ? 'index.html' : resolvedPath.slice(1);
  const file = resolve(root, relative);
  if (!file.startsWith(`${root}/`) || !isAllowedStaticPath(pathname)) return sendError(res, 404, 'Not found.');
  if (!existsSync(file) || !statSync(file).isFile()) return sendError(res, 404, 'Not found.');
  res.statusCode = 200;
  res.setHeader('Content-Type', contentTypes.get(extname(file)) || 'application/octet-stream');
  res.setHeader('Content-Length', statSync(file).size);
  res.setHeader('Cache-Control', ['.html', '.css', '.js'].includes(extname(file)) ? 'no-cache' : 'public, max-age=3600');
  if (req.method === 'HEAD') return res.end();
  return createReadStream(file).pipe(res);
}

const server = createServer(async (req, res) => {
  setSecurityHeaders(res);
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    return sendError(res, 400, 'Invalid path.');
  }
  const handler = apiRoutes.get(pathname);
  if (handler) return serveApi(req, res, handler);
  return serveStatic(req, res, pathname);
});

server.listen(port, '0.0.0.0', () => {
  process.stdout.write(`Portfolio preview listening on 0.0.0.0:${port}\n`);
});
