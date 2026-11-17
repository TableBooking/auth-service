import type { MigrationInterface, QueryRunner } from 'typeorm';
import { adoptLegacyTable, refuseLegacyRollback } from '../legacy-schema.js';
export class CreateRefreshSessions1794300001000 implements MigrationInterface {
  name = 'CreateRefreshSessions1794300001000';
  async up(runner: QueryRunner): Promise<void> {
    if (
      await adoptLegacyTable(runner, 'refresh_sessions', [
        ['id', 'uuid', false],
        ['user_id', 'uuid', false],
        ['token_hash', 'text', false],
        ['expires_at', 'timestamp with time zone', false],
        ['revoked_at', 'timestamp with time zone', true],
        ['created_at', 'timestamp with time zone', false],
        ['device_label', 'text', true],
        ['last_used_at', 'timestamp with time zone', true],
        ['family_id', 'uuid', false],
      ])
    )
      return;
    await runner.query(`CREATE TABLE refresh_sessions (
      id UUID CONSTRAINT refresh_sessions_pkey PRIMARY KEY,
      user_id UUID NOT NULL CONSTRAINT refresh_sessions_user_id_fkey REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL CONSTRAINT refresh_sessions_token_hash_key UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL, revoked_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), device_label TEXT, last_used_at TIMESTAMPTZ,
      family_id UUID NOT NULL
    )`);
    await runner.query(
      'CREATE INDEX ix_sessions_user ON refresh_sessions(user_id, expires_at DESC)',
    );
    await runner.query('CREATE INDEX ix_sessions_family ON refresh_sessions(family_id)');
  }
  async down(runner: QueryRunner): Promise<void> {
    await refuseLegacyRollback(runner);
    await runner.query('DROP TABLE refresh_sessions');
  }
}
