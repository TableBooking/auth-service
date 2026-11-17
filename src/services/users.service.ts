import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../core/database.service.js';
import { ROLE, type Role } from '../constants/role.constant.js';
import { UserRepository } from '../repositories/user.repository.js';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository.js';
import { UserFactory } from '../factories/user.factory.js';
import { AccountPolicy } from '../policies/account.policy.js';
import { PasswordService } from './password.service.js';
import { publicUser } from '../utils/user.util.js';
import type { RegisterInput } from '../dto/auth.dto.js';
@Injectable()
export class UsersService {
  constructor(
    private readonly database: DatabaseService,
    private readonly users: UserRepository,
    private readonly sessions: RefreshSessionRepository,
    private readonly factory: UserFactory,
    private readonly passwords: PasswordService,
    private readonly policy: AccountPolicy,
  ) {}
  async createUser(input: RegisterInput, role: Role = ROLE.CUSTOMER) {
    const user = this.factory.create(input, await this.passwords.hash(input.password), role);
    try {
      return publicUser(await this.users.insert(user));
    } catch (error) {
      const code =
        (error as { driverError?: { code?: string }; code?: string }).driverError?.code ??
        (error as { code?: string }).code;
      if (code === '23505')
        throw new ConflictException({
          code: 'EMAIL_EXISTS',
          message: 'Email is already registered',
        });
      throw error;
    }
  }
  async getUser(id: string) {
    const user = await this.users.findById(id);
    if (!user) throw this.notFound();
    return user;
  }
  async updateProfile(id: string, input: { fullName?: string; phone?: string }) {
    const user = await this.users.updateProfile(id, input);
    if (!user) throw this.notFound();
    return publicUser(user);
  }
  async listStaff(page: number, limit: number) {
    const [users, total] = await this.users.listStaff(page, limit);
    return {
      data: users.map(publicUser),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
  async setStatus(actorId: string, id: string, active: boolean) {
    return this.database.transaction(async (manager) => {
      await this.users.lockStatusChanges(manager);
      this.policy.assertManager(await this.users.lockById(actorId, manager));
      const user = await this.users.lockById(id, manager);
      if (!user) throw this.notFound();
      this.policy.assertStatusChange(user, active, await this.users.countActiveManagers(manager));
      const updated = await this.users.updateStatus(id, active, manager);
      if (!active) await this.sessions.revokeUser(id, manager);
      return publicUser(updated!);
    });
  }
  private notFound() {
    return new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found' });
  }
}
