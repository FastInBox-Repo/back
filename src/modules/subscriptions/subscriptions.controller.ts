import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';

import { Roles } from '../../common/decorators';
import type { SessionToken } from '../auth/auth.service';
import {
  SubscriptionsService,
  type CreateSubscriptionInput,
  type SubscriptionActor,
} from './subscriptions.service';
import type { Subscription } from './subscription.entity';

interface AuthedRequest extends Request {
  user?: SessionToken;
}

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Roles('admin', 'nutritionist')
  @Post()
  create(@Req() req: AuthedRequest, @Body() body: CreateSubscriptionInput) {
    return this.subscriptions.create(this.actor(req), body);
  }

  @Roles('admin', 'nutritionist')
  @Get()
  list(
    @Req() req: AuthedRequest,
    @Query('status') status?: Subscription['status'],
    @Query('clinicId') clinicId?: string,
  ) {
    const user = req.user!;
    if (user.role === 'admin') {
      // Admin is a global user (no clinicId) and sees every subscription,
      // optionally narrowed by ?clinicId / ?status.
      return this.subscriptions.list({ clinicId, status });
    }
    return this.subscriptions.list({
      clinicId: user.clinicId,
      nutritionistId: user.userId,
      status,
    });
  }

  @Roles('admin', 'nutritionist')
  @Get(':id')
  get(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.subscriptions.getScoped(this.actor(req), id);
  }

  @Roles('admin', 'nutritionist')
  @Post(':id/pause')
  pause(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.subscriptions.pause(this.actor(req), id);
  }

  @Roles('admin', 'nutritionist')
  @Post(':id/resume')
  resume(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.subscriptions.resume(this.actor(req), id);
  }

  @Roles('admin', 'nutritionist')
  @Post(':id/cancel')
  cancel(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.subscriptions.cancel(this.actor(req), id);
  }

  @Roles('admin')
  @Post('run')
  run() {
    return this.subscriptions.runDue();
  }

  private actor(req: AuthedRequest): SubscriptionActor {
    const user = req.user!;
    return {
      userId: user.userId,
      role: user.role as 'admin' | 'nutritionist',
      clinicId: user.clinicId,
    };
  }
}
