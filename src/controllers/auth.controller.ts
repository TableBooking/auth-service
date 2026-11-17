import { Body, Controller, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { UsersService } from '../services/users.service.js';
import { RefreshCookieService } from '../services/refresh-cookie.service.js';
import { Public } from '../core/decorators/auth.decorator.js';
import { OriginGuard } from '../core/guards/origin.guard.js';
import type { AuthRequest } from '../core/types/auth-request.type.js';
import { AUTH_ROUTES } from '../routes/auth.route.js';
import { registerInput, loginInput, passwordInput } from '../dto/auth.dto.js';
import { parse } from '../utils/validation.util.js';
import { unauthorized } from '../utils/auth-error.util.js';
@Controller(AUTH_ROUTES.prefix)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly cookies: RefreshCookieService,
  ) {}
  @Public()
  @Post(AUTH_ROUTES.register)
  register(@Body() body: unknown) {
    return this.users.createUser(parse(registerInput, body));
  }
  @Public()
  @Post(AUTH_ROUTES.login)
  @HttpCode(200)
  async login(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = parse(loginInput, body);
    const session = await this.auth.login(input.email, input.password);
    this.cookies.set(response, session.refreshToken);
    return session.body;
  }
  @Public()
  @UseGuards(OriginGuard)
  @Post(AUTH_ROUTES.refresh)
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const token = this.cookies.read(request);
      if (!token) throw unauthorized();
      const session = await this.auth.refresh(token);
      this.cookies.set(response, session.refreshToken);
      return session.body;
    } catch (error) {
      this.cookies.set(response, '', true);
      throw error;
    }
  }
  @Public()
  @UseGuards(OriginGuard)
  @Post(AUTH_ROUTES.logout)
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(this.cookies.read(request));
    this.cookies.set(response, '', true);
    return { ok: true };
  }
  @Post(AUTH_ROUTES.changePassword)
  @HttpCode(200)
  async changePassword(
    @Req() request: AuthRequest,
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ) {
    const input = parse(passwordInput, body);
    await this.auth.changePassword(request.user.id, input.currentPassword, input.newPassword);
    this.cookies.set(response, '', true);
    return { ok: true };
  }
}
