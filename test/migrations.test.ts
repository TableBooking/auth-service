import 'reflect-metadata';
import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { createDataSource } from '../src/config/database.config.js';
import { UserEntity } from '../src/entities/user.entity.js';
import { PasswordService } from '../src/services/password.service.js';

async function isolatedDatabase(t: TestContext) {
  const adminUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('TEST_DATABASE_URL or DATABASE_URL is required');
  const admin = new pg.Pool({ connectionString: adminUrl });
  const name = `auth_migration_test_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(adminUrl);
  url.pathname = '/' + name;
  const source = createDataSource(url.href);
  let created = false;
  t.after(async () => {
    if (source.isInitialized) await source.destroy();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
  });
  await admin.query(`CREATE DATABASE "${name}"`);
  created = true;
  await source.initialize();
  return source;
}

test('TypeORM migrations create, track, revert and rebuild an empty database explicitly', async (t) => {
  const source = await isolatedDatabase(t);
  const runner = source.createQueryRunner();
  try {
    assert.equal(await runner.hasTable('users'), false);
  } finally {
    await runner.release();
  }
  assert.equal(source.options.synchronize, false);
  assert.equal(source.options.migrationsRun, false);
  assert.equal((await source.runMigrations()).length, 2);
  assert.equal((await source.runMigrations()).length, 0);
  const history = await source.query('SELECT name FROM typeorm_migrations ORDER BY timestamp');
  assert.deepEqual(
    history.map((row: { name: string }) => row.name),
    ['CreateUsers1794300000000', 'CreateRefreshSessions1794300001000'],
  );
  const differences = await source.driver.createSchemaBuilder().log();
  assert.deepEqual(
    differences.upQueries.map((q) => q.query),
    [],
    'Entities must match migration schema',
  );
  await source.undoLastMigration();
  await source.undoLastMigration();
  assert.equal((await source.runMigrations()).length, 2);
});

test('legacy local database is adopted without changing existing accounts; rollback is refused', async (t) => {
  const source = await isolatedDatabase(t);
  // Exact historical DDL, kept independent from the new migrations.
  await source.query(`CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
    INSERT INTO schema_migrations(version) VALUES (1);
    CREATE TABLE users (id UUID PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL,
      full_name VARCHAR(150) NOT NULL, phone VARCHAR(30), role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER','STAFF','MANAGER')),
      active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now());
    CREATE UNIQUE INDEX ux_user_email_ci ON users(lower(email));
    CREATE TABLE refresh_sessions (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), device_label TEXT, last_used_at TIMESTAMPTZ, family_id UUID NOT NULL);
    CREATE INDEX ix_sessions_user ON refresh_sessions(user_id,expires_at DESC);
    CREATE INDEX ix_sessions_family ON refresh_sessions(family_id);`);
  const id = randomUUID();
  const hash = await new PasswordService().hash('LegacyPassword123!');
  await source.query(
    `INSERT INTO users(id,email,password_hash,full_name,role) VALUES ($1,$2,$3,$4,$5)`,
    [id, 'legacy@example.test', hash, 'Legacy User', 'CUSTOMER'],
  );
  assert.equal((await source.runMigrations()).length, 2);
  const user = await source.getRepository(UserEntity).findOneByOrFail({ id });
  assert.equal(user.email, 'legacy@example.test');
  assert.equal(user.passwordHash, undefined, 'password hash is hidden by default');
  await assert.rejects(source.undoLastMigration(), /Cannot drop tables adopted from legacy Auth/);
  assert.equal(await source.getRepository(UserEntity).count(), 1);
});

test('an unrelated pre-existing schema is rejected and preserved', async (t) => {
  const source = await isolatedDatabase(t);
  await source.query('CREATE TABLE users (id UUID PRIMARY KEY, custom_field TEXT)');
  await assert.rejects(source.runMigrations(), /does not match the legacy Auth schema/);
  const rows = await source.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position`,
  );
  assert.deepEqual(
    rows.map((row: { column_name: string }) => row.column_name),
    ['id', 'custom_field'],
  );
});
