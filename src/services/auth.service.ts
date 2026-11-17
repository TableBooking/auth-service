import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';
import { AUTH_CONFIG, type AuthConfig } from '../config/env.config.js';
import { DatabaseService } from '../core/database.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository.js';
import { RefreshSessionFactory } from '../factories/refresh-session.factory.js';
import { JwtService } from './jwt.service.js';
import { PasswordService } from './password.service.js';
import { UsersService } from './users.service.js';
import type { UserEntity } from '../entities/user.entity.js';
import { publicUser } from '../utils/user.util.js';
import { hashToken } from '../utils/token.util.js';
import { unauthorized } from '../utils/auth-error.util.js';
@Injectable()
export class AuthService {
  constructor(
    private readonly database: DatabaseService,
    private readonly users: UserRepository,
    private readonly sessions: RefreshSessionRepository,
    private readonly sessionFactory: RefreshSessionFactory,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly userService: UsersService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}
  async login(email: string, password: string) {
    const user = await this.users.findCredentialsByEmail(email);
    const hash = user?.passwordHash ?? 'scrypt$00000000000000000000000000000000$' + '00'.repeat(64);
    if (!(await this.passwords.verify(password, hash)) || !user?.active) throw unauthorized();
    return this.database.transaction(async (manager) => {
      const current = await this.users.lockById(user.id, manager);
      if (!current?.active || current.passwordHash !== user.passwordHash) throw unauthorized();
      return this.newSession(manager, current, randomUUID());
    });
  }
  private async newSession(manager: EntityManager, user: UserEntity, familyId: string) {
    const session = this.sessionFactory.create(
      user.id,
      familyId,
      this.config.REFRESH_TOKEN_TTL_SECONDS,
    );
    const accessToken = await this.jwt.issue(user);
    await this.sessions.insert(session.entity, manager);
    return {
      refreshToken: session.token,
      body: {
        accessToken,
        tokenType: 'Bearer',
        expiresIn: this.config.ACCESS_TOKEN_TTL_SECONDS,
        user: publicUser(user),
      },
    };
  }
  async refresh(token: string) {
    const result = await this.database.transaction(async (manager) => {
      const found = await this.sessions.findByHash(hashToken(token), manager);
      if (!found) return null;
      // All session mutations lock user first, then session to avoid lock-order inversions.
      const user = await this.users.lockById(found.userId, manager);
      const session = await this.sessions.findByHash(hashToken(token), manager, true);
      if (!session || !user) return null;
      if (session.revokedAt || !user.active || (await this.sessions.isExpired(session, manager))) {
        // Returning null commits family revocation before the controller receives 401.
        await this.sessions.revokeFamily(session.familyId, manager);
        return null;
      }
      await this.sessions.consume(session.id, manager);
      return this.newSession(manager, user, session.familyId);
    });
    if (!result) throw unauthorized();
    return result;
  }
  async logout(token?: string) {
    if (!token) return;
    await this.database.transaction(async (manager) => {
      const session = await this.sessions.findByHash(hashToken(token), manager);
      if (!session) return;
      await this.users.lockById(session.userId, manager);
      await this.sessions.revokeFamily(session.familyId, manager);
    });
  }
  async changePassword(id: string, currentPassword: string, newPassword: string) {
    const publicAccount = await this.userService.getUser(id);
    const user = await this.users.findCredentialsByEmail(publicAccount.email);
    if (!user || !(await this.passwords.verify(currentPassword, user.passwordHash)))
      throw unauthorized();
    const hash = await this.passwords.hash(newPassword);
    await this.database.transaction(async (manager) => {
      const current = await this.users.lockById(id, manager);
      if (!current?.active || current.passwordHash !== user.passwordHash) throw unauthorized();
      await this.users.updatePassword(id, hash, manager);
      await this.sessions.revokeUser(id, manager);
    });
  }
}
