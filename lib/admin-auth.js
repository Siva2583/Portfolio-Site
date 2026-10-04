import { ConfigurationError, UpstreamError, isUuid } from './http.js';
import { getSupabaseConfig, fetchWithTimeout, dbRequest } from './supabase.js';
import { requestUsesSecureTransport } from './request-security.js';

const ACCESS_COOKIE = 'sc_admin_access';
const REFRESH_COOKIE = 'sc_admin_refresh';

export function parseCookies(header = '') {
  const cookies = {};
  String(header).split(';').forEach((part) => {
    const separator = part.indexOf('=');
    if (separator < 1) return;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  });
  return cookies;
}

function addSetCookie(res, cookie) {
  const existing = res.getHeader?.('Set-Cookie');
  const next = Array.isArray(existing) ? [...existing, cookie] : existing ? [existing, cookie] : [cookie];
  res.setHeader('Set-Cookie', next);
}

function cookieParts(name, value, req, maxAge) {
  const secure = requestUsesSecureTransport(req) ? '; Secure' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/api/admin; Max-Age=${maxAge}; HttpOnly; SameSite=Strict${secure}`;
}

export function setSessionCookies(res, req, session) {
  const accessMaxAge = Math.max(60, Math.min(3600, Number(session.expires_in) || 3600));
  addSetCookie(res, cookieParts(ACCESS_COOKIE, session.access_token, req, accessMaxAge));
  addSetCookie(res, cookieParts(REFRESH_COOKIE, session.refresh_token, req, 60 * 60 * 24 * 30));
}

export function clearSessionCookies(res, req) {
  addSetCookie(res, cookieParts(ACCESS_COOKIE, '', req, 0));
  addSetCookie(res, cookieParts(REFRESH_COOKIE, '', req, 0));
}

export function readSessionCookies(req) {
  const cookies = parseCookies(req.headers?.cookie || '');
  return { accessToken: cookies[ACCESS_COOKIE] || '', refreshToken: cookies[REFRESH_COOKIE] || '' };
}

async function authRequest(path, { env, fetchImpl, body, token, method } = {}) {
  const config = getSupabaseConfig(env);
  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, `${config.baseUrl}${path}`, {
      method: method || (body ? 'POST' : 'GET'),
      headers: {
        apikey: config.anonKey,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        Accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, 8000);
  } catch {
    throw new UpstreamError('Supabase authentication is unavailable.');
  }
  const text = await response.text().catch(() => '');
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }
  return { ok: response.ok, status: response.status, data };
}

export async function signInWithPassword(email, password, { env = process.env, fetchImpl = fetch } = {}) {
  return authRequest('/auth/v1/token?grant_type=password', {
    env,
    fetchImpl,
    body: { email, password },
  });
}

export async function signOutToken(token, { env = process.env, fetchImpl = fetch } = {}) {
  if (!token) return;
  try {
    await authRequest('/auth/v1/logout', { env, fetchImpl, token, method: 'POST' });
  } catch {
    // Cookie revocation is best-effort; the browser cookies are still cleared.
  }
}

export async function isAdminUser(user, { env = process.env, fetchImpl = fetch } = {}) {
  if (!user || typeof user.id !== 'string' || !isUuid(user.id)) return false;
  const result = await dbRequest(`/rest/v1/admin_users?select=user_id&user_id=eq.${encodeURIComponent(user.id)}&limit=1`, {
    env,
    fetchImpl,
  });
  return Array.isArray(result) && result.some((row) => row.user_id === user.id);
}

async function getUserForToken(token, options) {
  if (!token) return null;
  const result = await authRequest('/auth/v1/user', { ...options, token });
  return result.ok ? result.data : null;
}

export async function requireAdmin(req, res, { env = process.env, fetchImpl = fetch } = {}) {
  let config;
  try {
    config = getSupabaseConfig(env);
  } catch (error) {
    const message = error instanceof ConfigurationError ? 'Private inbox authentication is not configured.' : 'Private inbox is unavailable.';
    return { ok: false, status: 503, error: message };
  }

  const session = readSessionCookies(req);
  if (!session.accessToken && !session.refreshToken) return { ok: false, status: 401, error: 'Authentication required.' };
  const options = { env, fetchImpl };
  let user = null;
  let accessToken = session.accessToken;
  try {
    user = await getUserForToken(accessToken, options);
    if (!user && session.refreshToken) {
      const refreshed = await authRequest('/auth/v1/token?grant_type=refresh_token', {
        env,
        fetchImpl,
        body: { refresh_token: session.refreshToken },
      });
      if (refreshed.ok && refreshed.data.access_token && refreshed.data.refresh_token) {
        accessToken = refreshed.data.access_token;
        user = refreshed.data.user || null;
        setSessionCookies(res, req, refreshed.data);
      }
    }
    if (!user) {
      clearSessionCookies(res, req);
      return { ok: false, status: 401, error: 'Session expired. Sign in again.' };
    }
    const authorized = await isAdminUser(user, { env, fetchImpl });
    if (!authorized) {
      clearSessionCookies(res, req);
      return { ok: false, status: 403, error: 'This account is not authorized for the private inbox.' };
    }
    return { ok: true, user: { id: user.id, email: user.email }, accessToken, config };
  } catch (error) {
    if (error instanceof ConfigurationError) return { ok: false, status: 503, error: 'Private inbox authentication is not configured.' };
    return { ok: false, status: 503, error: 'Private inbox is temporarily unavailable.' };
  }
}
