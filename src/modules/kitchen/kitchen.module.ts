import { Module } from '@nestjs/common';

import { KitchenController } from './kitchen.controller';
import { KitchenQueueService } from './kitchen-queue.service';

@Module({
  controllers: [KitchenController],
  providers: [KitchenQueueService],
  exports: [KitchenQueueService],
})
export class KitchenModule {}
