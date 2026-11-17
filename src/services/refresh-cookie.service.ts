import { Inject, Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from '../config/env.config.js';
import { REFRESH_COOKIE_PATH } from '../constants/auth.constant.js';
@Injectable()
export class RefreshCookieService {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {}
  set(response: Response, value: string, clear = false) {
    response.cookie(this.config.REFRESH_COOKIE_NAME, value, {
      httpOnly: true,
      secure: this.config.COOKIE_SECURE,
      sameSite: this.config.COOKIE_SAME_SITE,
      path: REFRESH_COOKIE_PATH,
      maxAge: clear ? 0 : this.config.REFRESH_TOKEN_TTL_SECONDS * 1000,
    });
  }
  read(request: Request) {
    const prefix = `${this.config.REFRESH_COOKIE_NAME}=`;
    const values = (request.headers.cookie ?? '')
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.startsWith(prefix));
    if (values.length !== 1) return undefined;
    const value = values[0]!.slice(prefix.length);
    return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : undefined;
  }
}
