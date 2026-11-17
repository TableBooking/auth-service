import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import pg, { type PoolClient } from 'pg';
import { AUTH_CONFIG, type AuthConfig } from './config/env.config.js';

export const migrationSql = `
CREATE TABLE IF NOT EXISTS users (
 id UUID PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL,
 full_name VARCHAR(150) NOT NULL, phone VARCHAR(30),
 role VARCHAR(20) NOT NULL CHECK (role IN ('CUSTOMER','STAFF','MANAGER')),
 active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_user_email_ci ON users (lower(email));
CREATE TABLE IF NOT EXISTS refresh_sessions (
 id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 device_label TEXT, last_used_at TIMESTAMPTZ,
 family_id UUID NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_sessions_user ON refresh_sessions(user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS ix_sessions_family ON refresh_sessions(family_id);
`;

@Injectable()
export class Database implements OnModuleDestroy {
  readonly pool: pg.Pool;
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    this.pool = new pg.Pool({
      connectionString: config.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      statement_timeout: 10000,
    });
    this.pool.on('error', () => console.error('Idle database connection failed'));
  }
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  async migrate() {
    await this.transaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(738194602)');
      await client.query(
        'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())',
      );
      const existing = await client.query(
        'SELECT version FROM schema_migrations WHERE version = 1',
      );
      if (!existing.rowCount) {
        await client.query(migrationSql);
        await client.query('INSERT INTO schema_migrations(version) VALUES (1)');
      }
    });
  }
  async onModuleDestroy() {
    await this.pool.end();
  }
}
