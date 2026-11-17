import { rateLimit } from 'express-rate-limit';
import type { AuthConfig } from '../config/env.config.js';
import { AUTH_ROUTES } from '../routes/auth.route.js';
const limitedRoutes = new Set(
  [AUTH_ROUTES.register, AUTH_ROUTES.login, AUTH_ROUTES.refresh].map(
    (path) => `/${AUTH_ROUTES.prefix}/${path}`,
  ),
);
export function authRateLimit(config: AuthConfig) {
  return rateLimit({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    limit: config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    // Gateway limits clients; Auth independently limits the socket peer without trusting XFF.
    validate: { xForwardedForHeader: false },
    skip: (request) => !limitedRoutes.has(request.path.replace(/\/$/, '')),
    handler: (_request, response) =>
      response.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
        correlationId: response.getHeader('x-request-id'),
      }),
  });
}
