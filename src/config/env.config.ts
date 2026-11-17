import { z } from 'zod';

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  DATABASE_URL: z
    .string()
    .url()
    .refine((v) => ['postgres:', 'postgresql:'].includes(new URL(v).protocol)),
  JWT_PRIVATE_KEY_PATH: z.string().min(1).default('./keys/auth-private.pem'),
  JWT_ISSUER: z.string().min(1).default('restaurant-auth'),
  JWT_AUDIENCE: z.string().min(1).default('restaurant-api'),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(30).max(3600).default(900),
  REFRESH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(2592000).default(604800),
  REFRESH_COOKIE_NAME: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+$/)
    .default('refresh_session'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((v) =>
      v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z.array(
        z
          .url()
          .refine((v) => {
            const u = new URL(v);
            return (
              ['http:', 'https:'].includes(u.protocol) &&
              !u.username &&
              !u.password &&
              u.pathname === '/' &&
              !u.search &&
              !u.hash
            );
          })
          .transform((v) => new URL(v).origin),
      ),
    ),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
});
export type AuthConfig = z.infer<typeof schema>;
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const result = schema.safeParse(env);
  if (!result.success)
    throw new Error(
      `Invalid configuration fields: ${result.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    );
  const c = result.data;
  if ((c.NODE_ENV === 'production' || c.COOKIE_SAME_SITE === 'none') && !c.COOKIE_SECURE) {
    throw new Error('Secure cookies are required in production and for SameSite=None');
  }
  return c;
}
