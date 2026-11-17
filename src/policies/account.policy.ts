import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ROLE, type Role } from '../constants/role.constant.js';
import type { UserEntity } from '../entities/user.entity.js';
import { unauthorized } from '../utils/auth-error.util.js';
@Injectable()
export class AccountPolicy {
  assertIdentity(user: UserEntity, tokenRole: Role) {
    if (!user.active || user.role !== tokenRole) throw unauthorized();
  }
  assertRole(role: Role, allowed?: readonly Role[]) {
    if (allowed && !allowed.includes(role))
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Insufficient role' });
  }
  assertManager(actor: UserEntity | null) {
    if (!actor?.active || actor.role !== ROLE.MANAGER)
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'An active manager is required' });
  }
  assertStatusChange(user: UserEntity, active: boolean, activeManagerCount: number) {
    if (!active && user.active && user.role === ROLE.MANAGER && activeManagerCount <= 1) {
      throw new ConflictException({
        code: 'LAST_MANAGER',
        message: 'Cannot disable the last active manager',
      });
    }
  }
}
