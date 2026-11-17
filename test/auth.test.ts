import assert from 'node:assert/strict';
import test from 'node:test';
import { SignJWT, importPKCS8 } from 'jose';
import { call, fixture } from './helpers.js';
import { UserRepository } from '../src/repositories/user.repository.js';

test('Auth API with real PostgreSQL: accounts, RBAC, JWT and session transactions', async (t) => {
  const f = await fixture(t);
  const request = (method: string, path: string, options?: Parameters<typeof call>[3]) =>
    call(f.baseUrl, method, path, options);
  const customer = {
    email: 'Guest@Example.Test',
    password: 'CustomerPassword123!',
    fullName: 'Guest',
    phone: '0900000000',
  };
  let customerId: string;
  let token: string;
  let managerToken: string;
  let staffId: string;
  await t.test(
    'registration validates fields, normalizes email, prevents role injection and duplicates',
    async () => {
      assert.equal(
        (await request('POST', '/api/auth/register', { body: { ...customer, role: 'MANAGER' } }))
          .status,
        400,
      );
      const registered = await request('POST', '/api/auth/register', { body: customer });
      assert.equal(registered.status, 201);
      assert.equal(registered.data.role, 'CUSTOMER');
      assert.equal(registered.data.email, 'guest@example.test');
      assert.equal(registered.data.password_hash, undefined);
      customerId = registered.data.id;
      assert.equal(
        (
          await request('POST', '/api/auth/register', {
            body: { ...customer, email: customer.email.toLowerCase() },
          })
        ).status,
        409,
      );
      const stored = await f.app.get(UserRepository).findCredentialsByEmail(customer.email);
      assert.ok(stored!.passwordHash.startsWith('scrypt$'));
      assert.ok(!stored!.passwordHash.includes(customer.password));
    },
  );
  await t.test('login, own profile, strict patch and direct Auth RBAC', async () => {
    assert.equal(
      (
        await request('POST', '/api/auth/login', {
          body: { email: customer.email, password: 'incorrectPassword' },
        })
      ).status,
      401,
    );
    const login = await request('POST', '/api/auth/login', {
      body: { email: customer.email, password: customer.password },
    });
    assert.equal(login.status, 200);
    token = login.data.accessToken;
    assert.match(login.response.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(login.response.headers.get('set-cookie')!, /Path=\/api\/auth/);
    assert.equal(login.data.refreshToken, undefined);
    assert.equal((await request('GET', '/api/users/me', { token })).data.id, customerId);
    assert.equal((await request('GET', '/api/users/me')).status, 401);
    assert.equal((await request('GET', '/api/users/staff', { token })).status, 403);
    assert.equal(
      (await request('POST', '/api/users/staff', { token, body: f.manager })).status,
      403,
    );
    assert.equal(
      (await request('PATCH', '/api/users/me', { token, body: { role: 'MANAGER' } })).status,
      400,
    );
    assert.equal(
      (await request('PATCH', '/api/users/me', { token, body: { fullName: 'Updated Guest' } })).data
        .fullName,
      'Updated Guest',
    );
    const manager = await request('POST', '/api/auth/login', {
      body: { email: f.manager.email, password: f.manager.password },
    });
    managerToken = manager.data.accessToken;
  });
  await t.test(
    'reject bad issuer, audience, expiry, signature algorithm and missing claims',
    async () => {
      const key = await importPKCS8(f.privatePem, 'RS256');
      for (const changes of [
        { iss: 'wrong' },
        { aud: 'wrong' },
        { exp: 1 },
        { sub: 'not-a-uuid' },
        { role: 'ADMIN' },
        { role: undefined },
      ]) {
        const jwt = await new SignJWT({
          sub: customerId,
          role: 'CUSTOMER',
          iss: 'restaurant-auth',
          aud: 'restaurant-api',
          exp: Math.floor(Date.now() / 1000) + 60,
          ...changes,
        })
          .setProtectedHeader({ alg: 'RS256' })
          .sign(key);
        assert.equal((await request('GET', '/api/users/me', { token: jwt })).status, 401);
      }
      const hs = await new SignJWT({ sub: customerId, role: 'CUSTOMER' })
        .setProtectedHeader({ alg: 'HS256' })
        .sign(new Uint8Array(32));
      assert.equal((await request('GET', '/api/users/me', { token: hs })).status, 401);
    },
  );
  await t.test(
    'manager creates/lists/locks staff; locked sessions cannot login or refresh',
    async () => {
      const staff = {
        email: 'staff@example.test',
        password: 'StaffPassword123!',
        fullName: 'Staff',
      };
      const created = await request('POST', '/api/users/staff', {
        token: managerToken,
        body: staff,
      });
      assert.equal(created.status, 201);
      assert.equal(created.data.role, 'STAFF');
      staffId = created.data.id;
      const listed = await request('GET', '/api/users/staff?page=1&limit=10', {
        token: managerToken,
      });
      assert.equal(listed.data.meta.total, 1);
      assert.equal(listed.data.data[0].id, staffId);
      assert.equal(
        (await request('GET', '/api/users/staff?limit=101', { token: managerToken })).status,
        400,
      );
      const logged = await request('POST', '/api/auth/login', {
        body: { email: staff.email, password: staff.password },
      });
      assert.equal(
        (await request('GET', '/api/users/staff', { token: logged.data.accessToken })).status,
        403,
      );
      assert.equal(
        (
          await request('PATCH', `/api/users/${staffId}/status`, {
            token: managerToken,
            body: { active: false },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request('POST', '/api/auth/login', {
            body: { email: staff.email, password: staff.password },
          })
        ).status,
        401,
      );
      assert.equal(
        (await request('GET', '/api/users/me', { token: logged.data.accessToken })).status,
        401,
      );
      assert.equal(
        (
          await request('POST', '/api/auth/refresh', {
            cookie: logged.cookie!,
            origin: 'http://localhost:5173',
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request('PATCH', `/api/users/${staffId}/status`, {
            token: managerToken,
            body: { active: true },
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await request('PATCH', `/api/users/${f.managerUser.id}/status`, {
            token: managerToken,
            body: { active: false },
          })
        ).status,
        409,
      );
    },
  );
  const loginCustomer = () =>
    request('POST', '/api/auth/login', {
      body: { email: customer.email, password: customer.password },
    });
  await t.test(
    'refresh checks Origin, rotates, and replay commits revocation of replacement',
    async () => {
      const session = await loginCustomer();
      assert.equal(
        (await request('POST', '/api/auth/refresh', { cookie: session.cookie! })).status,
        403,
      );
      const rotated = await request('POST', '/api/auth/refresh', {
        cookie: session.cookie!,
        origin: 'http://localhost:5173',
      });
      assert.equal(rotated.status, 200);
      assert.notEqual(rotated.cookie, session.cookie);
      assert.equal(
        (
          await request('POST', '/api/auth/refresh', {
            cookie: session.cookie!,
            origin: 'http://localhost:5173',
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request('POST', '/api/auth/refresh', {
            cookie: rotated.cookie!,
            origin: 'http://localhost:5173',
          })
        ).status,
        401,
      );
    },
  );
  await t.test('concurrent refresh admits one winner and detects reuse', async () => {
    const session = await loginCustomer();
    const results = await Promise.all(
      [1, 2].map(() =>
        request('POST', '/api/auth/refresh', {
          cookie: session.cookie!,
          origin: 'http://localhost:5173',
        }),
      ),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 401]);
    const replacement = results.find((r) => r.status === 200)!;
    assert.equal(
      (
        await request('POST', '/api/auth/refresh', {
          cookie: replacement.cookie!,
          origin: 'http://localhost:5173',
        })
      ).status,
      401,
    );
  });
  await t.test('logout is idempotent, clears cookie and revokes session', async () => {
    const session = await loginCustomer();
    const loggedOut = await request('POST', '/api/auth/logout', {
      cookie: session.cookie!,
      origin: 'http://localhost:5173',
    });
    assert.equal(loggedOut.status, 200);
    assert.match(loggedOut.response.headers.get('set-cookie')!, /Max-Age=0/);
    assert.equal(
      (await request('POST', '/api/auth/logout', { origin: 'http://localhost:5173' })).status,
      200,
    );
    assert.equal(
      (
        await request('POST', '/api/auth/refresh', {
          cookie: session.cookie!,
          origin: 'http://localhost:5173',
        })
      ).status,
      401,
    );
  });
  await t.test(
    'password change uses currentPassword contract and revokes every refresh session',
    async () => {
      const a = await loginCustomer();
      const b = await loginCustomer();
      assert.equal(
        (
          await request('POST', '/api/auth/change-password', {
            token,
            body: { oldPassword: customer.password, newPassword: 'ChangedPassword123!' },
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await request('POST', '/api/auth/change-password', {
            token,
            body: { currentPassword: 'incorrectPassword', newPassword: 'ChangedPassword123!' },
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request('POST', '/api/auth/change-password', {
            token,
            body: { currentPassword: customer.password, newPassword: 'ChangedPassword123!' },
          })
        ).status,
        200,
      );
      for (const session of [a, b])
        assert.equal(
          (
            await request('POST', '/api/auth/refresh', {
              cookie: session.cookie!,
              origin: 'http://localhost:5173',
            })
          ).status,
          401,
        );
      assert.equal((await loginCustomer()).status, 401);
      assert.equal(
        (
          await request('POST', '/api/auth/login', {
            body: { email: customer.email, password: 'ChangedPassword123!' },
          })
        ).status,
        200,
      );
    },
  );
});
