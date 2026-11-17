import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AUTH_CONFIG, type AuthConfig } from '../config/env.config.js';
import { createDataSource } from '../config/database.config.js';
import { DatabaseService } from './database.service.js';
import { AccessGuard } from './guards/access.guard.js';
import { OriginGuard } from './guards/origin.guard.js';
import { AuthController } from '../controllers/auth.controller.js';
import { UsersController } from '../controllers/users.controller.js';
import { HealthController } from '../controllers/health.controller.js';
import { AuthService } from '../services/auth.service.js';
import { UsersService } from '../services/users.service.js';
import { JwtService } from '../services/jwt.service.js';
import { PasswordService } from '../services/password.service.js';
import { RefreshCookieService } from '../services/refresh-cookie.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { RefreshSessionRepository } from '../repositories/refresh-session.repository.js';
import { UserFactory } from '../factories/user.factory.js';
import { RefreshSessionFactory } from '../factories/refresh-session.factory.js';
import { AccountPolicy } from '../policies/account.policy.js';
@Module({})
export class AppModule {
  static register(config: AuthConfig) {
    return {
      module: AppModule,
      controllers: [AuthController, UsersController, HealthController],
      providers: [
        { provide: AUTH_CONFIG, useValue: config },
        {
          provide: DataSource,
          useFactory: async () => {
            const source = createDataSource(config.DATABASE_URL);
            try {
              return await source.initialize();
            } catch {
              if (source.isInitialized) await source.destroy();
              throw new Error(
                'Cannot connect to PostgreSQL; check DATABASE_URL and create the database before starting Auth',
              );
            }
          },
        },
        DatabaseService,
        UserRepository,
        RefreshSessionRepository,
        UserFactory,
        RefreshSessionFactory,
        AccountPolicy,
        PasswordService,
        JwtService,
        UsersService,
        AuthService,
        RefreshCookieService,
        OriginGuard,
        { provide: APP_GUARD, useClass: AccessGuard },
      ],
    };
  }
}
