import type { QueryRunner } from 'typeorm';

type LegacyColumn = readonly [name: string, type: string, nullable: boolean, length?: string];
// Only the previous local implementation may be adopted, never an arbitrary existing schema.
export async function adoptLegacyTable(
  runner: QueryRunner,
  tableName: string,
  columns: readonly LegacyColumn[],
) {
  if (!(await runner.hasTable(tableName))) return false;
  const fail = () =>
    new Error(
      `Existing ${tableName} does not match the legacy Auth schema. Review the database before migrating; no data was changed.`,
    );
  if (!(await runner.hasTable('schema_migrations'))) throw fail();
  const versions: { version: number }[] = await runner.query(
    'SELECT version FROM schema_migrations',
  );
  if (versions.length !== 1 || versions[0]?.version !== 1) throw fail();
  const table = await runner.getTable(tableName);
  if (!table || table.columns.length !== columns.length) throw fail();
  for (const [name, type, nullable, length] of columns) {
    const column = table.findColumnByName(name);
    if (
      !column ||
      column.type !== type ||
      column.isNullable !== nullable ||
      (length && column.length !== length)
    )
      throw fail();
  }
  if (table.primaryColumns.length !== 1 || table.primaryColumns[0]?.name !== 'id') throw fail();
  if (tableName === 'users') {
    if (
      !table.checks.some((check) =>
        ['CUSTOMER', 'STAFF', 'MANAGER'].every((role) => check.expression?.includes(role)),
      )
    )
      throw fail();
    const indices: { indexdef: string }[] = await runner.query(
      `SELECT indexdef FROM pg_indexes WHERE schemaname = current_schema() AND tablename = 'users' AND indexname = 'ux_user_email_ci'`,
    );
    if (!indices[0] || !/UNIQUE.*lower\(email\)/i.test(indices[0].indexdef)) throw fail();
  } else {
    if (
      !table.uniques.some(
        (key) => key.columnNames.length === 1 && key.columnNames[0] === 'token_hash',
      )
    )
      throw fail();
    if (
      !table.foreignKeys.some(
        (fk) =>
          fk.columnNames[0] === 'user_id' &&
          fk.referencedTableName === 'users' &&
          fk.onDelete === 'CASCADE',
      )
    )
      throw fail();
    if (
      !['ix_sessions_user', 'ix_sessions_family'].every((name) =>
        table.indices.some((index) => index.name === name),
      )
    )
      throw fail();
  }
  return true;
}

export async function refuseLegacyRollback(runner: QueryRunner) {
  if (await runner.hasTable('schema_migrations')) {
    throw new Error(
      'Cannot drop tables adopted from legacy Auth. Preserve the existing data; create a forward migration instead.',
    );
  }
}
