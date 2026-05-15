import { Controller, Get, Query } from '@nestjs/common';

import { Roles } from '../../common/decorators';
import { UsersService } from './users.service';
import type { UserRole } from './user.entity';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles('admin')
  list(@Query('clinicId') clinicId?: string, @Query('role') role?: UserRole) {
    return this.users
      .list({ clinicId, role })
      .map((u) => this.users.toPublic(u));
  }
}
