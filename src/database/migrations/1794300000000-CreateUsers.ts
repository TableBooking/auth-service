import type { MigrationInterface, QueryRunner } from 'typeorm';
import { adoptLegacyTable, refuseLegacyRollback } from '../legacy-schema.js';
export class CreateUsers1794300000000 implements MigrationInterface {
  name = 'CreateUsers1794300000000';
  async up(runner: QueryRunner): Promise<void> {
    if (
      await adoptLegacyTable(runner, 'users', [
        ['id', 'uuid', false],
        ['email', 'text', false],
        ['password_hash', 'text', false],
        ['full_name', 'character varying', false, '150'],
        ['phone', 'character varying', true, '30'],
        ['role', 'character varying', false, '20'],
        ['active', 'boolean', false],
        ['created_at', 'timestamp with time zone', false],
        ['updated_at', 'timestamp with time zone', false],
      ])
    )
      return;
    await runner.query(`CREATE TABLE users (
      id UUID CONSTRAINT users_pkey PRIMARY KEY, email TEXT NOT NULL, password_hash TEXT NOT NULL,
      full_name VARCHAR(150) NOT NULL, phone VARCHAR(30),
      role VARCHAR(20) NOT NULL CONSTRAINT users_role_check CHECK (role IN ('CUSTOMER','STAFF','MANAGER')),
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await runner.query('CREATE UNIQUE INDEX ux_user_email_ci ON users (lower(email))');
  }
  async down(runner: QueryRunner): Promise<void> {
    await refuseLegacyRollback(runner);
    await runner.query('DROP TABLE users');
  }
}
