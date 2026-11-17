import { Controller, Get } from '@nestjs/common';
import { Public } from '../core/decorators/auth.decorator.js';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository.js';
import { HEALTH_ROUTES } from '../routes/health.route.js';
@Public()
@Controller(HEALTH_ROUTES.prefix)
export class HealthController {
  constructor(private readonly sessions: RefreshSessionRepository) {}
  @Get(HEALTH_ROUTES.live) live() {
    return { auth: 'ok' };
  }
  @Get(HEALTH_ROUTES.ready) async ready() {
    await this.sessions.isReady();
    return { auth: 'ok', database: 'ok' };
  }
}
