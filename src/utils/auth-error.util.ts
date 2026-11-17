import { UnauthorizedException } from '@nestjs/common';
export function unauthorized() {
  return new UnauthorizedException({
    code: 'UNAUTHORIZED',
    message: 'Invalid credentials or session',
  });
}
