export function isSameOrigin(req, env = process.env) {
  const origin = req.headers?.origin;
  if (typeof origin !== 'string' || !origin) return false;
  let parsedOrigin;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(parsedOrigin.protocol) || parsedOrigin.username || parsedOrigin.password) return false;

  const configuredOrigin = env.ALLOWED_ORIGIN?.trim();
  if (configuredOrigin) {
    try {
      return parsedOrigin.origin === new URL(configuredOrigin).origin;
    } catch {
      return false;
    }
  }

  const forwardedHost = req.headers?.['x-forwarded-host'];
  const requestHost = String(forwardedHost || req.headers?.host || '').split(',')[0].trim();
  if (!requestHost || parsedOrigin.host.toLowerCase() !== requestHost.toLowerCase()) return false;
  const localHttp = ['localhost', '127.0.0.1', '[::1]'].includes(parsedOrigin.hostname);
  return parsedOrigin.protocol === 'https:' || localHttp;
}

export function requestUsesSecureTransport(req) {
  const forwardedProtocol = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return forwardedProtocol === 'https' || process.env.NODE_ENV === 'production';
}
