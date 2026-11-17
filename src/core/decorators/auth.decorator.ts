import { SetMetadata } from '@nestjs/common';
import { PUBLIC_METADATA, ROLES_METADATA } from '../../constants/auth.constant.js';
import type { Role } from '../../constants/role.constant.js';
export const Public = () => SetMetadata(PUBLIC_METADATA, true);
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_METADATA, roles);
