import test from 'node:test';
import assert from 'node:assert/strict';
import { createContactHandler } from '../api/contact.js';

const env = {
  SUPABASE_URL: 'https://portfolio-test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  CONTACT_RATE_LIMIT_SECRET: 'a-test-only-secret-with-at-least-thirty-two-characters',
  RESEND_API_KEY: 're_test_key',
  CONTACT_TO_EMAIL: 'siva@example.com',
  CONTACT_FROM_EMAIL: 'Portfolio <portfolio@example.com>',
  ALLOWED_ORIGIN: 'https://portfolio.example',
};

const body = {
  name: 'Taylor Recruiter',
  email: 'taylor@example.com',
  company: 'Northwind',
  role: 'Backend Engineer',
  subject: 'Engineering opportunity',
  message: 'I would like to discuss a backend engineering opportunity with you.',
  linkedin: '',
  website: '',
};

function request(bodyValue = body, extraHeaders = {}) {
  return {
    method: 'POST',
    url: '/api/contact',
    headers: {
      host: 'portfolio.example',
      origin: 'https://portfolio.example',
      'content-type': 'application/json',
      ...extraHeaders,
    },
    body: bodyValue,
  };
}

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

function fakeFetch({ allowed = true, mailStatus = 200, storageStatus = 201 } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('/rpc/consume_contact_rate_limit')) {
      return new Response(JSON.stringify(allowed), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (String(url).includes('/rest/v1/messages?select=')) {
      if (storageStatus >= 400) return new Response('failure', { status: storageStatus });
      return new Response(JSON.stringify([{ id: '76c2dced-8a23-4ea5-bab0-6b0f3290dc10', created_at: '2026-10-04T12:00:00.000Z' }]), { status: storageStatus });
    }
    if (String(url).endsWith('/rest/v1/message_events')) return new Response(null, { status: 201 });
    if (String(url) === 'https://api.resend.com/emails') return new Response(mailStatus < 300 ? '{}' : 'provider error', { status: mailStatus });
    throw new Error(`Unexpected test request: ${url}`);
  };
  return { fetchImpl, calls };
}

test('contact API validates, stores, records an event, and sends notification', async () => {
  const fake = fakeFetch();
  const handler = createContactHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, { ok: true, stored: true, notification: 'sent' });
  const insert = fake.calls.find((call) => call.url.includes('/rest/v1/messages?select='));
  assert.equal(JSON.parse(insert.options.body).status, 'unread');
  assert.equal(JSON.parse(insert.options.body).email, 'taylor@example.com');
  const email = fake.calls.find((call) => call.url === 'https://api.resend.com/emails');
  const emailBody = JSON.parse(email.options.body);
  assert.equal(emailBody.subject, 'New portfolio message from Taylor Recruiter');
  assert.match(emailBody.text, /Received: 2026-10-04T12:00:00.000Z/);
  assert.ok(fake.calls.some((call) => call.url.endsWith('/rest/v1/message_events')));
});

test('email provider failure does not discard an already stored message', async () => {
  const fake = fakeFetch({ mailStatus: 429 });
  const handler = createContactHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 202);
  assert.deepEqual(res.body, { ok: true, stored: true, notification: 'delayed' });
});

test('rate limit blocks before database insertion', async () => {
  const fake = fakeFetch({ allowed: false });
  const handler = createContactHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 429);
  assert.equal(fake.calls.filter((call) => call.url.includes('/rest/v1/messages?select=')).length, 0);
});

test('invalid form data is rejected after rate-limit accounting', async () => {
  const fake = fakeFetch();
  const handler = createContactHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request({ ...body, email: 'not-an-email' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(fake.calls.filter((call) => call.url.includes('/rpc/consume_contact_rate_limit')).length, 1);
  assert.equal(fake.calls.filter((call) => call.url.includes('/rest/v1/messages?select=')).length, 0);
});

test('cross-origin contact writes are rejected without calling services', async () => {
  const fake = fakeFetch();
  const handler = createContactHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(body, { origin: 'https://attacker.example' }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(fake.calls.length, 0);
});

test('database failure produces an honest error instead of a fake success', async () => {
  const fake = fakeFetch({ storageStatus: 500 });
  const handler = createContactHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const res = response();
  await handler(request(), res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.stored, undefined);
  assert.match(res.body.error, /could not be stored/);
});
