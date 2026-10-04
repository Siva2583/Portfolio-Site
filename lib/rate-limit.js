import { createHmac } from 'node:crypto';
import { ConfigurationError, UpstreamError } from './http.js';
import { dbRequest } from './supabase.js';

export function getRateLimitFingerprint(req, scope, secret) {
  if (typeof secret !== 'string' || secret.length < 32) {
    throw new ConfigurationError('Rate-limit secret must contain at least 32 characters.');
  }
  const realIp = req.headers?.['x-real-ip'];
  const forwarded = req.headers?.['x-forwarded-for'];
  const address = String(realIp || forwarded || 'unknown').split(',')[0].trim().slice(0, 100);
  return createHmac('sha256', secret).update(`${scope}:${address}`).digest('hex');
}

export async function consumeRateLimit(req, {
  env = process.env,
  fetchImpl = fetch,
  scope = 'contact',
  limit = 5,
  windowSeconds = 3600,
} = {}) {
  const fingerprint = getRateLimitFingerprint(req, scope, env.CONTACT_RATE_LIMIT_SECRET);
  const result = await dbRequest('/rest/v1/rpc/consume_contact_rate_limit', {
    env,
    fetchImpl,
    method: 'POST',
    body: {
      p_fingerprint: fingerprint,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    },
  });
  if (typeof result === 'boolean') return result;
  if (Array.isArray(result) && result.length === 1 && typeof result[0] === 'boolean') return result[0];
  throw new UpstreamError('Rate-limit service returned an invalid response.');
}
