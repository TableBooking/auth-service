import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { loadConfig } from './config/env.config.js';
import { AppModule } from './core/app.module.js';
import { HttpExceptionFilter } from './core/filters/http-exception.filter.js';
import { requestContext } from './middleware/request-context.middleware.js';
import { authRateLimit } from './middleware/auth-rate-limit.middleware.js';
export async function createApplication(environment: NodeJS.ProcessEnv = process.env) {
  const config = loadConfig(environment);
  const app = await NestFactory.create<NestExpressApplication>(AppModule.register(config), {
    logger: false,
    abortOnError: false,
    bodyParser: false,
  });
  try {
    app.disable('x-powered-by');
    app.set('trust proxy', false);
    app.use(requestContext(config.NODE_ENV !== 'test'));
    app.use(helmet());
    app.enableCors({
      origin: config.CORS_ORIGINS.length ? config.CORS_ORIGINS : false,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    });
    app.use(authRateLimit(config));
    app.useBodyParser('json', { limit: '16kb' });
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
