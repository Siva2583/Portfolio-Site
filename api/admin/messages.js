import { requireAdmin } from '../../lib/admin-auth.js';
import { bodyByteLength, isUuid, parseBody, sendJson, sendMethodNotAllowed, UpstreamError } from '../../lib/http.js';
import { isSameOrigin } from '../../lib/request-security.js';
import { dbRequest } from '../../lib/supabase.js';

const ALLOWED_STATUSES = new Set(['unread', 'read', 'replied', 'archived']);
const MESSAGE_FIELDS = 'id,name,email,company,role,subject,message,linkedin,status,created_at,updated_at';

async function writeEvent({ env, fetchImpl, messageId, actorId, event, metadata = {} }) {
  await dbRequest('/rest/v1/message_events', {
    env,
    fetchImpl,
    method: 'POST',
    body: { message_id: messageId, actor_user_id: actorId, event, metadata },
    prefer: 'return=minimal',
  });
}

export function createMessagesHandler({ env = process.env, fetchImpl = fetch, logger = console } = {}) {
  return async function messagesHandler(req, res) {
    const auth = await requireAdmin(req, res, { env, fetchImpl });
    if (!auth.ok) return sendJson(res, auth.status, { error: auth.error });

    if (req.method === 'GET') {
      const url = new URL(req.url, `https://${req.headers?.host || 'portfolio.invalid'}`);
      const id = url.searchParams.get('id');
      if (id && !isUuid(id)) return sendJson(res, 400, { error: 'Invalid message id.' });
      const filter = id ? `&id=eq.${encodeURIComponent(id)}` : '';
      try {
        const messages = await dbRequest(`/rest/v1/messages?select=${MESSAGE_FIELDS}&order=created_at.desc&limit=100${filter}`, { env, fetchImpl });
        return sendJson(res, 200, { messages: Array.isArray(messages) ? messages : [], email: auth.user.email });
      } catch {
        logger.error?.('Private inbox message query failed.');
        return sendJson(res, 503, { error: 'Messages could not be loaded.' });
      }
    }

    if (req.method !== 'PATCH' && req.method !== 'DELETE') return sendMethodNotAllowed(res, ['GET', 'PATCH', 'DELETE']);
    if (!isSameOrigin(req, env)) return sendJson(res, 403, { error: 'Request origin is not allowed.' });
    if (req.method === 'PATCH' && !String(req.headers?.['content-type'] || '').toLowerCase().includes('application/json')) {
      return sendJson(res, 415, { error: 'Send a JSON request.' });
    }
    if (req.method === 'PATCH' && bodyByteLength(req) > 4096) return sendJson(res, 413, { error: 'Request is too large.' });

    const url = new URL(req.url, `https://${req.headers?.host || 'portfolio.invalid'}`);
    const body = req.method === 'PATCH' ? parseBody(req) : {};
    const id = req.method === 'PATCH' ? body?.id : url.searchParams.get('id');
    if (!isUuid(id)) return sendJson(res, 400, { error: 'Invalid message id.' });
    if (req.method === 'PATCH' && !ALLOWED_STATUSES.has(body?.status)) {
      return sendJson(res, 400, { error: 'Invalid message status.' });
    }

    try {
      const previousRows = await dbRequest(`/rest/v1/messages?select=id,status&id=eq.${encodeURIComponent(id)}&limit=1`, { env, fetchImpl });
      const previous = Array.isArray(previousRows) ? previousRows[0] : null;
      if (!previous) return sendJson(res, 404, { error: 'Message not found.' });

      if (req.method === 'PATCH') {
        const updatedRows = await dbRequest(`/rest/v1/messages?id=eq.${encodeURIComponent(id)}`, {
          env,
          fetchImpl,
          method: 'PATCH',
          body: { status: body.status, updated_at: new Date().toISOString() },
          prefer: 'return=representation',
        });
        const updated = Array.isArray(updatedRows) ? updatedRows[0] : null;
        if (!updated) return sendJson(res, 404, { error: 'Message not found.' });
        if (previous.status !== body.status) {
          try {
            await writeEvent({ env, fetchImpl, messageId: id, actorId: auth.user.id, event: 'status_changed', metadata: { from: previous.status, to: body.status } });
          } catch {
            logger.warn?.('Private inbox status event could not be recorded.');
          }
        }
        return sendJson(res, 200, { ok: true, message: updated });
      }

      const deletedRows = await dbRequest(`/rest/v1/messages?id=eq.${encodeURIComponent(id)}`, {
        env,
        fetchImpl,
        method: 'DELETE',
        prefer: 'return=representation',
      });
      if (!Array.isArray(deletedRows) || deletedRows.length === 0) return sendJson(res, 404, { error: 'Message not found.' });
      try {
        await writeEvent({ env, fetchImpl, messageId: null, actorId: auth.user.id, event: 'deleted', metadata: { message_id: id, previous_status: previous.status } });
      } catch {
        logger.warn?.('Private inbox deletion event could not be recorded.');
      }
      return sendJson(res, 200, { ok: true, deleted: true });
    } catch (error) {
      if (error instanceof UpstreamError) logger.error?.('Private inbox message update failed.');
      else logger.error?.('Private inbox operation failed.');
      return sendJson(res, 503, { error: 'Message could not be updated.' });
    }
  };
}

export default createMessagesHandler();
