import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { format } from 'prettier';

const root = fileURLToPath(new URL('..', import.meta.url));
const folder = resolve(root, 'src/database/migrations');
const [operation, target, ...extra] = process.argv.slice(2);
if (!['create', 'generate'].includes(operation) || !target || extra.length) {
  throw new Error('Use migration:create or migration:generate -- src/database/migrations/Name');
}
const destination = resolve(root, target);
if (
  dirname(destination) !== folder ||
  !/^[A-Za-z][A-Za-z0-9_-]*$/.test(destination.slice(folder.length + 1))
) {
  throw new Error('Migration must be a named direct child of src/database/migrations');
}
const before = new Set(await readdir(folder));
const argumentsList = [
  resolve(root, 'node_modules/typeorm/cli.js'),
  `migration:${operation}`,
  destination,
];
if (operation === 'generate') argumentsList.push('-d', resolve(root, 'dist/config/data-source.js'));
const result = spawnSync(process.execPath, argumentsList, {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
});
if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  for (const name of await readdir(folder)) {
    if (before.has(name) || !/^\d+-.*\.ts$/.test(name)) continue;
    const path = resolve(folder, name);
    let content = (await readFile(path, 'utf8')).replace(
      /import\s*\{\s*MigrationInterface\s*,\s*QueryRunner\s*\}\s*from\s*(['"])typeorm\1;/,
      "import type { MigrationInterface, QueryRunner } from 'typeorm';",
    );
    if (operation === 'create') content = content.replace(/\bqueryRunner\b/g, '_queryRunner');
    await writeFile(
      path,
      await format(content, {
        parser: 'typescript',
        singleQuote: true,
        printWidth: 100,
        trailingComma: 'all',
      }),
    );
  }
}
