import { ConfigurationError, UpstreamError } from './http.js';

export function getSupabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL?.trim();
  const anonKey = env.SUPABASE_ANON_KEY?.trim();
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !anonKey || !serviceKey) throw new ConfigurationError('Supabase configuration is incomplete.');
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ConfigurationError('Supabase URL is invalid.');
  }
  if (parsed.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new ConfigurationError('Supabase URL must use HTTPS.');
  }
  return { baseUrl: url.replace(/\/$/, ''), anonKey, serviceKey };
}

export async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function dbRequest(path, options = {}) {
  const {
    env = process.env,
    fetchImpl = fetch,
    method = 'GET',
    body,
    prefer,
    headers = {},
  } = options;
  const config = getSupabaseConfig(env);
  const requestHeaders = {
    apikey: config.serviceKey,
    Authorization: `Bearer ${config.serviceKey}`,
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  if (prefer) requestHeaders.Prefer = prefer;

  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, `${config.baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }, 8000);
  } catch {
    throw new UpstreamError('Supabase request failed.');
  }
  const text = await response.text().catch(() => '');
  if (!response.ok) throw new UpstreamError('Supabase request failed.', response.status >= 500 ? 503 : 400);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new UpstreamError('Supabase returned an invalid response.');
  }
}
