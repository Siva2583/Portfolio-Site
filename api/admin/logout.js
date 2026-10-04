import { clearSessionCookies, readSessionCookies, signOutToken } from '../../lib/admin-auth.js';
import { sendJson, sendMethodNotAllowed } from '../../lib/http.js';
import { isSameOrigin } from '../../lib/request-security.js';

export default async function logoutHandler(req, res) {
  if (req.method !== 'POST') return sendMethodNotAllowed(res, ['POST']);
  if (!isSameOrigin(req)) return sendJson(res, 403, { error: 'Request origin is not allowed.' });
  const session = readSessionCookies(req);
  await signOutToken(session.accessToken, {});
  clearSessionCookies(res, req);
  return sendJson(res, 200, { ok: true });
}
