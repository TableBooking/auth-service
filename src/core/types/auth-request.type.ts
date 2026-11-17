import type { Request } from 'express';
import type { Role } from '../../constants/role.constant.js';
export interface AuthRequest extends Request {
  user: { id: string; role: Role };
}
