import { Controller, Get, Param } from '@nestjs/common';

import { Roles } from '../../common/decorators';
import { KitchenQueueService } from './kitchen-queue.service';

@Controller('kitchens')
export class KitchenController {
  constructor(private readonly queue: KitchenQueueService) {}

  @Roles('admin', 'kitchen')
  @Get(':kitchenId/queue')
  list(@Param('kitchenId') kitchenId: string) {
    return this.queue.listQueue(kitchenId);
  }
}
