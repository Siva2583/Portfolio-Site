import { isAdminUser, setSessionCookies, signInWithPassword, signOutToken } from '../../lib/admin-auth.js';
import { sanitizeSingleLine } from '../../lib/contact-validation.js';
import { bodyByteLength, ConfigurationError, parseBody, sendJson, UpstreamError, sendMethodNotAllowed } from '../../lib/http.js';
import { isSameOrigin } from '../../lib/request-security.js';
import { consumeRateLimit } from '../../lib/rate-limit.js';

export function createLoginHandler({ env = process.env, fetchImpl = fetch, logger = console } = {}) {
  return async function loginHandler(req, res) {
    if (req.method !== 'POST') return sendMethodNotAllowed(res, ['POST']);
    if (!isSameOrigin(req, env)) return sendJson(res, 403, { error: 'Request origin is not allowed.' });
    if (!String(req.headers?.['content-type'] || '').toLowerCase().includes('application/json')) {
      return sendJson(res, 415, { error: 'Send a JSON request.' });
    }
    if (bodyByteLength(req) > 8192) return sendJson(res, 413, { error: 'Request is too large.' });

    let permitted;
    try {
      permitted = await consumeRateLimit(req, { env, fetchImpl, scope: 'admin-login', limit: 5, windowSeconds: 900 });
    } catch (error) {
      if (error instanceof ConfigurationError) return sendJson(res, 503, { error: 'Inbox authentication is not configured.' });
      return sendJson(res, 503, { error: 'Inbox authentication is temporarily unavailable.' });
    }
    if (!permitted) return sendJson(res, 429, { error: 'Too many sign-in attempts. Try again later.' });

    const body = parseBody(req);
    const email = sanitizeSingleLine(body?.email, 254).toLowerCase();
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!email || email.length > 254 || password.length < 1 || password.length > 256) {
      return sendJson(res, 400, { error: 'Enter a valid email and password.' });
    }

    try {
      const signedIn = await signInWithPassword(email, password, { env, fetchImpl });
      if (!signedIn.ok || !signedIn.data?.access_token || !signedIn.data?.refresh_token || !signedIn.data?.user) {
        return sendJson(res, 401, { error: 'Email or password is incorrect.' });
      }
      const allowed = await isAdminUser(signedIn.data.user, { env, fetchImpl });
      if (!allowed) {
        await signOutToken(signedIn.data.access_token, { env, fetchImpl });
        return sendJson(res, 403, { error: 'This account is not authorized for the private inbox.' });
      }
      setSessionCookies(res, req, signedIn.data);
      return sendJson(res, 200, { ok: true, email: signedIn.data.user.email });
    } catch (error) {
      logger.error?.('Private inbox sign-in failed.');
      if (error instanceof ConfigurationError || error instanceof UpstreamError) {
        return sendJson(res, 503, { error: 'Inbox authentication is temporarily unavailable.' });
      }
      return sendJson(res, 503, { error: 'Inbox authentication is temporarily unavailable.' });
    }
  };
}

export default createLoginHandler();
