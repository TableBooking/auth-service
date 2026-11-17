import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UserEntity } from '../entities/user.entity.js';
import type { Role } from '../constants/role.constant.js';
import type { RegisterInput } from '../dto/auth.dto.js';
@Injectable()
export class UserFactory {
  create(input: RegisterInput, passwordHash: string, role: Role): UserEntity {
    return Object.assign(new UserEntity(), {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName,
      phone: input.phone ?? null,
      role,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
