import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_CONFIG, type AuthConfig } from '../../config/env.config.js';
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}
  canActivate(context: ExecutionContext) {
    const origin = context.switchToHttp().getRequest<Request>().get('origin');
    if (!origin || !this.config.CORS_ORIGINS.includes(origin)) {
      throw new ForbiddenException({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'A trusted Origin is required',
      });
    }
    return true;
  }
}
