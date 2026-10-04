import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplyHandler } from '../api/admin/reply.js';

const userId = '123e4567-e89b-42d3-a456-426614174000';
const messageId = '76c2dced-8a23-4ea5-bab0-6b0f3290dc10';
const env = {
  SUPABASE_URL: 'https://portfolio-test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  ALLOWED_ORIGIN: 'https://portfolio.example',
  RESEND_API_KEY: 're_test_key',
  CONTACT_TO_EMAIL: 'siva@example.com',
  CONTACT_FROM_EMAIL: 'Portfolio <portfolio@example.com>',
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

function makeFetch({ admin = true, emailStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const textUrl = String(url);
    calls.push({ url: textUrl, options });
    if (textUrl.endsWith('/auth/v1/user')) return new Response(JSON.stringify({ id: userId, email: 'siva@example.com' }), { status: 200 });
    if (textUrl.includes('/rest/v1/admin_users')) return new Response(JSON.stringify(admin ? [{ user_id: userId }] : []), { status: 200 });
    if (textUrl.includes('/rest/v1/messages?select=id,name,email,subject,message,status')) {
      return new Response(JSON.stringify([{ id: messageId, name: 'Taylor', email: 'taylor@example.com', subject: 'Backend role', message: 'Original message text', status: 'read' }]), { status: 200 });
    }
    if (textUrl === 'https://api.resend.com/emails') return new Response(emailStatus < 300 ? '{}' : 'provider error', { status: emailStatus });
    if (textUrl.includes('/rest/v1/messages?id=eq.') && options.method === 'PATCH') return new Response(null, { status: 204 });
    if (textUrl.endsWith('/rest/v1/message_events')) return new Response(null, { status: 201 });
    throw new Error(`Unexpected reply request: ${textUrl}`);
  };
  return { fetchImpl, calls };
}

function request() {
  return {
    method: 'POST',
    url: '/api/admin/reply',
    headers: {
      host: 'portfolio.example',
      origin: 'https://portfolio.example',
      'content-type': 'application/json',
      cookie: 'sc_admin_access=access-token',
    },
    body: { id: messageId, message: 'Thank you for reaching out. I would be glad to discuss the role.' },
  };
}

test('authorized reply uses the stored recipient, sends through Resend, and marks replied', async () => {
  const fake = makeFetch();
  const handler = createReplyHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true, delivered: true, statusUpdated: true });
  const emailCall = fake.calls.find((call) => call.url === 'https://api.resend.com/emails');
  const email = JSON.parse(emailCall.options.body);
  assert.deepEqual(email.to, ['taylor@example.com']);
  assert.equal(email.subject, 'Re: Backend role');
  assert.match(email.text, /Thank you for reaching out/);
  assert.ok(fake.calls.some((call) => call.options.method === 'PATCH'));
  assert.ok(fake.calls.some((call) => call.url.endsWith('/rest/v1/message_events')));
});

test('reply is not sent to an unauthorized session', async () => {
  const fake = makeFetch({ admin: false });
  const handler = createReplyHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 403);
  assert.equal(fake.calls.some((call) => call.url === 'https://api.resend.com/emails'), false);
});

test('email provider failure leaves original message status untouched', async () => {
  const fake = makeFetch({ emailStatus: 429 });
  const handler = createReplyHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(fake.calls.some((call) => call.options.method === 'PATCH'), false);
});
