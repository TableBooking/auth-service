import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
const base = process.env.GATEWAY_URL ?? 'http://localhost:8081';
const origin = process.env.SMOKE_ORIGIN ?? 'http://localhost:5173';
const password = randomBytes(24).toString('base64url');
const input = {
  email: `smoke-${randomUUID()}@example.test`,
  password,
  fullName: 'Gateway smoke test',
};
async function call(method, path, expected, { body, token, cookie } = {}) {
  const response = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${path}: expected ${expected}, received ${response.status} (${data.code ?? ''})`,
  );
  console.log(`PASS ${method} ${path} -> ${expected}`);
  return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
await call('GET', '/api/health', 200);
await call('POST', '/api/auth/register', 201, { body: input });
const login = await call('POST', '/api/auth/login', 200, {
  body: { email: input.email, password },
});
assert.ok(login.cookie?.startsWith('refresh_session='));
const me = await call('GET', '/api/users/me', 200, { token: login.data.accessToken });
assert.equal(me.data.email, input.email);
await call('GET', '/api/users/staff', 403, { token: login.data.accessToken });
await call('GET', '/api/users/me', 401);
const rotated = await call('POST', '/api/auth/refresh', 200, { cookie: login.cookie });
assert.ok(rotated.cookie && rotated.cookie !== login.cookie);
await call('POST', '/api/auth/logout', 200, { cookie: rotated.cookie });
await call('POST', '/api/auth/refresh', 401, { cookie: rotated.cookie });
console.log(
  'Gateway -> Auth -> PostgreSQL smoke passed (one isolated CUSTOMER test account retained).',
);
