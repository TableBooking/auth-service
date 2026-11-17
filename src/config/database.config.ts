import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { fileURLToPath } from 'node:url';
import { UserEntity } from '../entities/user.entity.js';
import { RefreshSessionEntity } from '../entities/refresh-session.entity.js';
export function createDataSource(databaseUrl: string) {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [UserEntity, RefreshSessionEntity],
    migrations: [
      fileURLToPath(new URL('../database/migrations/[0-9]*-*.js', import.meta.url)).replaceAll(
        '\\',
        '/',
      ),
    ],
    migrationsTableName: 'typeorm_migrations',
    synchronize: false,
    migrationsRun: false,
    migrationsTransactionMode: 'all',
    logging: false,
    extra: { max: 10, connectionTimeoutMillis: 5000, statement_timeout: 10000 },
  });
}
