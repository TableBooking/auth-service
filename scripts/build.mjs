import { rm, realpath } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const output = resolve(root, 'dist');
// Remove only this project's explicit build directory; never follow a substituted junction.
try {
  if ((await realpath(output)) !== output || dirname(output) !== root)
    throw new Error('Unexpected build path');
  await rm(output, { recursive: true });
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const result = spawnSync(
  process.execPath,
  [resolve(root, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.build.json'],
  { cwd: root, stdio: 'inherit' },
);
process.exitCode = result.status ?? 1;
