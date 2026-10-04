import { validateContact } from '../lib/contact-validation.js';
import { bodyByteLength, ConfigurationError, parseBody, sendJson, UpstreamError, sendMethodNotAllowed } from '../lib/http.js';
import { isSameOrigin } from '../lib/request-security.js';
import { consumeRateLimit } from '../lib/rate-limit.js';
import { dbRequest } from '../lib/supabase.js';
import { hasNotificationConfig, sendEmail } from '../lib/email.js';

export function createContactHandler({ env = process.env, fetchImpl = fetch, logger = console } = {}) {
  return async function contactHandler(req, res) {
    if (req.method !== 'POST') return sendMethodNotAllowed(res, ['POST']);
    if (!isSameOrigin(req, env)) return sendJson(res, 403, { error: 'Request origin is not allowed.' });
    if (!String(req.headers?.['content-type'] || '').toLowerCase().includes('application/json')) {
      return sendJson(res, 415, { error: 'Send a JSON request.' });
    }
    if (bodyByteLength(req) > 16_384) return sendJson(res, 413, { error: 'Request is too large.' });

    let permitted;
    try {
      permitted = await consumeRateLimit(req, { env, fetchImpl, scope: 'contact', limit: 5, windowSeconds: 3600 });
    } catch (error) {
      if (error instanceof ConfigurationError) return sendJson(res, 503, { error: 'Contact service is not configured.' });
      return sendJson(res, 503, { error: 'Contact service is temporarily unavailable.' });
    }
    if (!permitted) return sendJson(res, 429, { error: 'Please wait before sending another message.' });

    const body = parseBody(req);
    const validation = validateContact(body);
    if (!validation.ok) return sendJson(res, 400, { error: validation.error });

    const now = new Date().toISOString();
    const record = {
      ...validation.value,
      status: 'unread',
      updated_at: now,
    };
    let saved;
    try {
      const rows = await dbRequest('/rest/v1/messages?select=id,created_at', {
        env,
        fetchImpl,
        method: 'POST',
        body: record,
        prefer: 'return=representation',
      });
      saved = Array.isArray(rows) ? rows[0] : null;
      if (!saved?.id) throw new UpstreamError('The message could not be stored.');
    } catch (error) {
      if (error instanceof ConfigurationError) return sendJson(res, 503, { error: 'Contact service is not configured.' });
      logger.error?.('Portfolio contact storage failed.');
      return sendJson(res, 503, { error: 'Message could not be stored. Please use direct email.' });
    }

    try {
      await dbRequest('/rest/v1/message_events', {
        env,
        fetchImpl,
        method: 'POST',
        body: { message_id: saved.id, event: 'received', metadata: { source: 'portfolio-contact' } },
        prefer: 'return=minimal',
      });
    } catch {
      logger.warn?.('Portfolio contact event could not be recorded.');
    }

    let notification = { sent: false, reason: 'not-configured' };
    if (hasNotificationConfig(env)) {
      const timestamp = saved.created_at || now;
      const text = [
        `Name: ${record.name}`,
        `Company: ${record.company || '—'}`,
        `Role: ${record.role || '—'}`,
        `Email: ${record.email}`,
        `LinkedIn: ${record.linkedin || '—'}`,
        `Received: ${timestamp}`,
        '',
        'Message:',
        record.message,
      ].join('\n');
      try {
        notification = await sendEmail({
          to: env.CONTACT_TO_EMAIL.trim(),
          subject: `New portfolio message from ${record.name}`,
          text,
          env,
          fetchImpl,
        });
      } catch {
        notification = { sent: false, reason: 'provider-unavailable' };
      }
    }

    if (!notification.sent) logger.warn?.('Portfolio message stored; email notification was not sent.');
    return sendJson(res, notification.sent ? 201 : 202, {
      ok: true,
      stored: true,
      notification: notification.sent ? 'sent' : 'delayed',
    });
  };
}

export default createContactHandler();
