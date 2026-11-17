import type { UserEntity } from '../entities/user.entity.js';
export function publicUser(user: UserEntity) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    ...(user.phone === null ? {} : { phone: user.phone }),
    role: user.role,
    active: user.active,
    createdAt: user.createdAt.toISOString(),
  };
}
