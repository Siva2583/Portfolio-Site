import test from 'node:test';
import assert from 'node:assert/strict';
import { createLoginHandler } from '../api/admin/login.js';
import { requireAdmin, parseCookies } from '../lib/admin-auth.js';
import { isSameOrigin } from '../lib/request-security.js';

const userId = '123e4567-e89b-42d3-a456-426614174000';
const user = { id: userId, email: 'siva@example.com' };
const env = {
  SUPABASE_URL: 'https://portfolio-test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  CONTACT_RATE_LIMIT_SECRET: 'a-test-only-secret-with-at-least-thirty-two-characters',
  ALLOWED_ORIGIN: 'https://portfolio.example',
};

function resMock() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    getHeader(name) { return this.headers[name.toLowerCase()]; },
    json(payload) { this.body = payload; return this; },
  };
}

function makeAuthFetch({ admin = true, loginOk = true } = {}) {
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    const textUrl = String(url);
    calls.push({ url: textUrl, options });
    if (textUrl.includes('/rpc/consume_contact_rate_limit')) return new Response('true', { status: 200 });
    if (textUrl.includes('/auth/v1/token?grant_type=password')) {
      if (!loginOk) return new Response(JSON.stringify({ msg: 'invalid login' }), { status: 400 });
      return new Response(JSON.stringify({ access_token: 'access-token', refresh_token: 'refresh-token', expires_in: 3600, user }), { status: 200 });
    }
    if (textUrl.includes('/auth/v1/user')) return new Response(JSON.stringify(user), { status: 200 });
    if (textUrl.includes('/rest/v1/admin_users')) {
      const rows = admin ? [{ user_id: userId }] : [];
      return new Response(JSON.stringify(rows), { status: 200 });
    }
    if (textUrl.endsWith('/auth/v1/logout')) return new Response(null, { status: 204 });
    throw new Error(`Unexpected authentication request: ${url}`);
  };
  return { fetchImpl, calls };
}

test('same-origin guard accepts only the configured website origin', () => {
  assert.equal(isSameOrigin({ headers: { origin: 'https://portfolio.example', host: 'portfolio.example' } }, env), true);
  assert.equal(isSameOrigin({ headers: { origin: 'https://attacker.example', host: 'portfolio.example' } }, env), false);
  assert.equal(isSameOrigin({ headers: { host: 'portfolio.example' } }, env), false);
});

test('cookie parser handles multiple values without losing token punctuation', () => {
  assert.deepEqual(parseCookies('a=one; sc_admin_access=abc.def.ghi; encoded=hello%20world'), {
    a: 'one',
    sc_admin_access: 'abc.def.ghi',
    encoded: 'hello world',
  });
});

test('login issues HttpOnly, Secure, SameSite=Strict cookies only to an authorized admin', async () => {
  const fake = makeAuthFetch();
  const handler = createLoginHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const req = {
    method: 'POST',
    url: '/api/admin/login',
    headers: { host: 'portfolio.example', origin: 'https://portfolio.example', 'x-forwarded-proto': 'https', 'content-type': 'application/json' },
    body: { email: user.email, password: 'not-stored-in-browser' },
  };
  const res = resMock();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.email, user.email);
  const cookies = res.headers['set-cookie'];
  assert.equal(cookies.length, 2);
  assert.ok(cookies.every((cookie) => cookie.includes('HttpOnly') && cookie.includes('Secure') && cookie.includes('SameSite=Strict')));
  assert.ok(cookies.every((cookie) => cookie.includes('Path=/api/admin')));
  assert.equal(JSON.parse(fake.calls.find((call) => call.url.includes('grant_type=password')).options.body).password, 'not-stored-in-browser');
});

test('valid Supabase authentication alone is insufficient without admin_users membership', async () => {
  const fake = makeAuthFetch({ admin: false });
  const handler = createLoginHandler({ env, fetchImpl: fake.fetchImpl, logger: { warn() {}, error() {} } });
  const req = {
    method: 'POST',
    url: '/api/admin/login',
    headers: { host: 'portfolio.example', origin: 'https://portfolio.example', 'x-forwarded-proto': 'https', 'content-type': 'application/json' },
    body: { email: user.email, password: 'valid-but-not-authorized' },
  };
  const res = resMock();
  await handler(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.headers['set-cookie'], undefined);
  assert.ok(fake.calls.some((call) => call.url.endsWith('/auth/v1/logout')));
});

test('every inbox read verifies the session and admin membership server-side', async () => {
  const fake = makeAuthFetch();
  const req = { headers: { cookie: 'sc_admin_access=access-token; sc_admin_refresh=refresh-token' } };
  const res = resMock();
  const result = await requireAdmin(req, res, { env, fetchImpl: fake.fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.user.email, user.email);
  assert.ok(fake.calls.some((call) => call.url.includes('/auth/v1/user')));
  assert.ok(fake.calls.some((call) => call.url.includes('/rest/v1/admin_users')));
});

test('expired or absent session is rejected and stale cookies are cleared', async () => {
  const fake = makeAuthFetch();
  const req = { headers: { cookie: 'sc_admin_access=expired-token' } };
  const res = resMock();
  const result = await requireAdmin(req, res, { env, fetchImpl: async (url, options) => {
    if (String(url).includes('/auth/v1/user')) return new Response('{}', { status: 401 });
    return fake.fetchImpl(url, options);
  } });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.ok(res.headers['set-cookie'].some((cookie) => cookie.includes('Max-Age=0')));
});
