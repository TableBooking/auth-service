import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { UsersService } from '../services/users.service.js';
import { Roles } from '../core/decorators/auth.decorator.js';
import type { AuthRequest } from '../core/types/auth-request.type.js';
import { USER_ROUTES } from '../routes/user.route.js';
import { ROLE } from '../constants/role.constant.js';
import { paginationInput, profileInput, staffInput, statusInput } from '../dto/auth.dto.js';
import { parse } from '../utils/validation.util.js';
import { publicUser } from '../utils/user.util.js';
@Controller(USER_ROUTES.prefix)
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get(USER_ROUTES.me)
  async me(@Req() request: AuthRequest) {
    return publicUser(await this.users.getUser(request.user.id));
  }
  @Patch(USER_ROUTES.me)
  patchMe(@Req() request: AuthRequest, @Body() body: unknown) {
    return this.users.updateProfile(request.user.id, parse(profileInput, body));
  }
  @Roles(ROLE.MANAGER)
  @Get(USER_ROUTES.staff)
  list(@Query() query: unknown) {
    const { page, limit } = parse(paginationInput, query);
    return this.users.listStaff(page, limit);
  }
  @Roles(ROLE.MANAGER)
  @Post(USER_ROUTES.staff)
  create(@Body() body: unknown) {
    return this.users.createUser(parse(staffInput, body), ROLE.STAFF);
  }
  @Roles(ROLE.MANAGER)
  @Patch(USER_ROUTES.status)
  status(
    @Req() request: AuthRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: unknown,
  ) {
    return this.users.setStatus(request.user.id, id, parse(statusInput, body).active);
  }
}
