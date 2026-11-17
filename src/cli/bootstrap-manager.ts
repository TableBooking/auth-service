import 'reflect-metadata';
import { createDataSource } from '../config/database.config.js';
import { loadConfig } from '../config/env.config.js';
import { DatabaseService } from '../core/database.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository.js';
import { UserFactory } from '../factories/user.factory.js';
import { AccountPolicy } from '../policies/account.policy.js';
import { UsersService } from '../services/users.service.js';
import { PasswordService } from '../services/password.service.js';
import { ROLE } from '../constants/role.constant.js';
import { staffInput } from '../dto/auth.dto.js';
import { parse } from '../utils/validation.util.js';
const source = createDataSource(loadConfig().DATABASE_URL);
try {
  const input = parse(staffInput, {
    email: process.env.BOOTSTRAP_MANAGER_EMAIL,
    password: process.env.BOOTSTRAP_MANAGER_PASSWORD,
    fullName: process.env.BOOTSTRAP_MANAGER_NAME,
  });
  await source.initialize();
  const users = new UsersService(
    new DatabaseService(source),
    new UserRepository(source),
    new RefreshSessionRepository(source),
    new UserFactory(),
    new PasswordService(),
    new AccountPolicy(),
  );
  console.log(`Manager created: ${(await users.createUser(input, ROLE.MANAGER)).id}`);
} catch {
  console.error('Manager bootstrap failed; check input, database, migrations and duplicate email');
  process.exitCode = 1;
} finally {
  if (source.isInitialized) await source.destroy();
}
