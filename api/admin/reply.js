import { requireAdmin } from '../../lib/admin-auth.js';
import { validateReply } from '../../lib/contact-validation.js';
import { bodyByteLength, isUuid, parseBody, sendJson, sendMethodNotAllowed } from '../../lib/http.js';
import { isSameOrigin } from '../../lib/request-security.js';
import { hasNotificationConfig, sendEmail } from '../../lib/email.js';
import { dbRequest } from '../../lib/supabase.js';

export function createReplyHandler({ env = process.env, fetchImpl = fetch, logger = console } = {}) {
  return async function replyHandler(req, res) {
    if (req.method !== 'POST') return sendMethodNotAllowed(res, ['POST']);
    const auth = await requireAdmin(req, res, { env, fetchImpl });
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });
    if (!isSameOrigin(req, env)) return sendJson(res, 403, { error: 'Request origin is not allowed.' });
    if (!String(req.headers?.['content-type'] || '').toLowerCase().includes('application/json')) {
      return sendJson(res, 415, { error: 'Send a JSON request.' });
    }
    if (bodyByteLength(req) > 8192) return sendJson(res, 413, { error: 'Request is too large.' });
    if (!hasNotificationConfig(env)) return sendJson(res, 503, { error: 'Reply email is not configured.' });

    const body = parseBody(req);
    if (!isUuid(body?.id)) return sendJson(res, 400, { error: 'Invalid message id.' });
    const validated = validateReply(body);
    if (!validated.ok) return sendJson(res, 400, { error: validated.error });

    try {
      const rows = await dbRequest(`/rest/v1/messages?select=id,name,email,subject,message,status&id=eq.${encodeURIComponent(body.id)}&limit=1`, { env, fetchImpl });
      const original = Array.isArray(rows) ? rows[0] : null;
      if (!original) return sendJson(res, 404, { error: 'Message not found.' });

      const text = [
        `Hi ${original.name},`,
        '',
        validated.value.message,
        '',
        '— Siva Charan',
        '',
        'Original message:',
        `Subject: ${original.subject}`,
        original.message,
      ].join('\n');
      const delivery = await sendEmail({
        to: original.email,
        subject: `Re: ${original.subject}`,
        text,
        env,
        fetchImpl,
      });
      if (!delivery.sent) return sendJson(res, 503, { error: 'Reply could not be delivered. The message remains in the inbox.' });

      try {
        await dbRequest(`/rest/v1/messages?id=eq.${encodeURIComponent(body.id)}`, {
          env,
          fetchImpl,
          method: 'PATCH',
          body: { status: 'replied', updated_at: new Date().toISOString() },
          prefer: 'return=minimal',
        });
      } catch {
        logger.warn?.('Reply was sent but inbox status could not be updated.');
        return sendJson(res, 202, { ok: true, delivered: true, statusUpdated: false });
      }
      try {
        await dbRequest('/rest/v1/message_events', {
          env,
          fetchImpl,
          method: 'POST',
          body: { message_id: body.id, actor_user_id: auth.user.id, event: 'reply_sent', metadata: { delivery: 'resend' } },
          prefer: 'return=minimal',
        });
      } catch {
        logger.warn?.('Reply event could not be recorded.');
      }
      return sendJson(res, 200, { ok: true, delivered: true, statusUpdated: true });
    } catch {
      logger.error?.('Private inbox reply failed.');
      return sendJson(res, 503, { error: 'Reply could not be delivered. The message remains in the inbox.' });
    }
  };
}

export default createReplyHandler();
