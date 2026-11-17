import 'reflect-metadata';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import type { TestContext } from 'node:test';
import { createApplication } from '../src/bootstrap.js';
import { UsersService } from '../src/services/users.service.js';
import { createDataSource } from '../src/config/database.config.js';

export async function fixture(t: TestContext) {
  const adminUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!adminUrl)
    throw new Error(
      'Set TEST_DATABASE_URL (or DATABASE_URL) to a local PostgreSQL with CREATE DATABASE permission',
    );
  const admin = new pg.Pool({ connectionString: adminUrl });
  const databaseName = `auth_test_${randomUUID().replaceAll('-', '')}`;
  const directory = await mkdtemp(join(tmpdir(), 'tablebooking-auth-'));
  const privatePath = join(directory, 'private.pem');
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { format: 'pem', type: 'pkcs8' },
    publicKeyEncoding: { format: 'pem', type: 'spki' },
  });
  await writeFile(privatePath, pair.privateKey, { mode: 0o600 });
  const url = new URL(adminUrl);
  url.pathname = '/' + databaseName;
  const environment = {
    NODE_ENV: 'test',
    DATABASE_URL: url.href,
    JWT_PRIVATE_KEY_PATH: privatePath,
    CORS_ORIGINS: 'http://localhost:5173',
    AUTH_RATE_LIMIT_MAX: '1000',
  };
  let app: Awaited<ReturnType<typeof createApplication>> | undefined;
  let created = false;
  t.after(async () => {
    await app?.close();
    if (created) await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await unlink(privatePath);
    await rmdir(directory);
  });
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  created = true;
  const migration = createDataSource(environment.DATABASE_URL);
  try {
    await migration.initialize();
    await migration.runMigrations();
    await migration.runMigrations();
  } finally {
    if (migration.isInitialized) await migration.destroy();
  }
  app = await createApplication(environment);
  await app.listen(0, '127.0.0.1');
  const baseUrl = await app.getUrl();
  const manager = {
    email: 'manager@example.test',
    password: 'ManagerPassword123!',
    fullName: 'Manager',
  };
  const managerUser = await app.get(UsersService).createUser(manager, 'MANAGER');
  return { app, baseUrl, environment, manager, managerUser, privatePem: pair.privateKey };
}
export async function call(
  base: string,
  method: string,
  path: string,
  options: { body?: unknown; token?: string; cookie?: string; origin?: string } = {},
) {
  const response = await fetch(base + path, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      ...(options.origin ? { Origin: options.origin } : {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.cookie ? { Cookie: options.cookie } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const data = (await response.json()) as Record<string, any>;
  return {
    response,
    data,
    status: response.status,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}
