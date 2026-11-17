import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '../../services/jwt.service.js';
import { UsersService } from '../../services/users.service.js';
import { AccountPolicy } from '../../policies/account.policy.js';
import { PUBLIC_METADATA, ROLES_METADATA } from '../../constants/auth.constant.js';
import type { Role } from '../../constants/role.constant.js';
import type { AuthRequest } from '../types/auth-request.type.js';
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly users: UsersService,
    private readonly policy: AccountPolicy,
  ) {}
  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_METADATA, targets)) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const identity = await this.jwt.verify(request.get('authorization'));
    const user = await this.users.getUser(identity.id);
    this.policy.assertIdentity(user, identity.role);
    this.policy.assertRole(
      user.role,
      this.reflector.getAllAndOverride<Role[]>(ROLES_METADATA, targets),
    );
    request.user = identity;
    return true;
  }
}
