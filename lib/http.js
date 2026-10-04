export class ConfigurationError extends Error {
  constructor(message = 'Required server configuration is missing.') {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class UpstreamError extends Error {
  constructor(message = 'A required service is unavailable.', status = 503) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
  }
}

export function setApiHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
}

export function sendJson(res, status, data) {
  setApiHeaders(res);
  return res.status(status).json(data);
}

export function sendMethodNotAllowed(res, methods) {
  res.setHeader('Allow', methods.join(', '));
  return sendJson(res, 405, { error: 'Method not allowed.' });
}

export function parseBody(req) {
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  const text = Buffer.isBuffer(body) ? body.toString('utf8') : body;
  if (typeof text !== 'string' || text.length === 0) return {};
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function bodyByteLength(req) {
  const body = req.body;
  if (Buffer.isBuffer(body)) return body.byteLength;
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
  if (body && typeof body === 'object') return Buffer.byteLength(JSON.stringify(body), 'utf8');
  return 0;
}

export function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
