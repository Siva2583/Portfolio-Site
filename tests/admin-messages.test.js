import test from 'node:test';
import assert from 'node:assert/strict';
import { createMessagesHandler } from '../api/admin/messages.js';

const userId = '123e4567-e89b-42d3-a456-426614174000';
const messageId = '76c2dced-8a23-4ea5-bab0-6b0f3290dc10';
const env = {
  SUPABASE_URL: 'https://portfolio-test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  ALLOWED_ORIGIN: 'https://portfolio.example',
};
const message = {
  id: messageId,
  name: 'Taylor Recruiter',
  email: 'taylor@example.com',
  subject: 'Backend opportunity',
  message: 'I would like to discuss a backend engineering role.',
  status: 'read',
  created_at: '2026-10-04T12:00:00.000Z',
  updated_at: '2026-10-04T12:00:00.000Z',
};

function response() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    json(payload) { this.body = payload; return this; },
  };
}

function mockFetch({ admin = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const textUrl = String(url);
    calls.push({ url: textUrl, options });
    if (textUrl.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: userId, email: 'siva@example.com' }), { status: 200 });
    if (textUrl.includes('/rest/v1/admin_users')) return new Response(JSON.stringify(admin ? [{ user_id: userId }] : []), { status: 200 });
    if (textUrl.includes('/rest/v1/messages?select=id,status')) return new Response(JSON.stringify([{ id: messageId, status: 'unread' }]), { status: 200 });
    if (textUrl.includes('/rest/v1/messages?id=eq.') && options.method === 'PATCH') {
      const patch = JSON.parse(options.body);
      return new Response(JSON.stringify([{ ...message, ...patch }]), { status: 200 });
    }
    if (textUrl.includes('/rest/v1/messages?id=eq.') && options.method === 'DELETE') {
      return new Response(JSON.stringify([message]), { status: 200 });
    }
    if (textUrl.endsWith('/rest/v1/message_events')) return new Response(null, { status: 201 });
    throw new Error(`Unexpected message request: ${textUrl}`);
  };
  return { fetchImpl, calls };
}

function request(status) {
  return {
    method: 'PATCH',
    url: '/api/admin/messages',
    headers: {
      host: 'portfolio.example',
      origin: 'https://portfolio.example',
      'content-type': 'application/json',
      cookie: 'sc_admin_access=access-token',
    },
    body: { id: messageId, status },
  };
}

test('authorized inbox status changes are persisted and audited', async () => {
  const fake = mockFetch();
  const handler = createMessagesHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request('read'), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message.status, 'read');
  const patch = fake.calls.find((call) => call.options.method === 'PATCH');
  assert.equal(JSON.parse(patch.options.body).status, 'read');
  const event = fake.calls.find((call) => call.url.endsWith('/rest/v1/message_events'));
  assert.equal(JSON.parse(event.options.body).event, 'status_changed');
  assert.deepEqual(JSON.parse(event.options.body).metadata, { from: 'unread', to: 'read' });
});

test('invalid status values are rejected before a database update', async () => {
  const fake = mockFetch();
  const handler = createMessagesHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request('deleted'), res);
  assert.equal(res.statusCode, 400);
  assert.equal(fake.calls.filter((call) => call.options.method === 'PATCH').length, 0);
});

test('inbox deletion removes the message before recording an audit event', async () => {
  const fake = mockFetch();
  const handler = createMessagesHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler({
    ...request('read'),
    method: 'DELETE',
    url: `/api/admin/messages?id=${messageId}`,
  }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, deleted: true });
  const deleteIndex = fake.calls.findIndex((call) => call.options.method === 'DELETE');
  const eventIndex = fake.calls.findIndex((call) => call.url.endsWith('/rest/v1/message_events'));
  assert.ok(deleteIndex >= 0 && eventIndex > deleteIndex);
  assert.equal(JSON.parse(fake.calls[eventIndex].options.body).message_id, null);
});

test('a valid session without admin authorization cannot access message records', async () => {
  const fake = mockFetch({ admin: false });
  const handler = createMessagesHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request('archived'), res);
  assert.equal(res.statusCode, 403);
  assert.equal(fake.calls.filter((call) => call.url.includes('/rest/v1/messages')).length, 0);
});
